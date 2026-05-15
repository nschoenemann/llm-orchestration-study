import { OpenAIEmbeddings }               from '@langchain/openai'
import { CohereEmbeddings }               from '@langchain/cohere'
import { MemoryVectorStore }              from '@langchain/classic/vectorstores/memory'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { Document }                       from '@langchain/core/documents'
import { readFileSync, readdirSync }      from 'fs'
import { join }                           from 'path'

// ── RAG Configuration ─────────────────────────────────────────────────────────
export interface RAGConfig {
    chunkSize:         number
    chunkOverlap:      number
    embeddingProvider: 'openai' | 'cohere'
    embeddingModel:    string
}

export const RAG_DEFAULT: RAGConfig = {
    chunkSize:         500,
    chunkOverlap:      50,
    embeddingProvider: 'openai',
    embeddingModel:    'text-embedding-3-small',
}

export const RAG_COHERE: RAGConfig = {
    chunkSize:         500,
    chunkOverlap:      50,
    embeddingProvider: 'cohere',
    embeddingModel:    'embed-multilingual-v3.0',
}

// ── Filter ────────────────────────────────────────────────────────────────────
export interface RetrievalFilter {
    region:   string
    asOfDate: string
}

// ── Interner Zustand ──────────────────────────────────────────────────────────
let vectorStore: MemoryVectorStore | null = null

// ── Policy-Header parsen ──────────────────────────────────────────────────────
// Liest REGION und EFFECTIVE_FROM aus dem Header:
// [POLICY_ID: OPS-DELAY | VERSION: v2 | EFFECTIVE_FROM: 2026-01-01 | REGION: EU]
// [POLICY_ID: OPS-DELAY | VERSION: v3 | EFFECTIVE_FROM: 2025-01-01 | REGION: ME, EU]
function parseHeader(text: string): { regions: string[]; effectiveFrom: string } {
    const match = text.match(/\[POLICY_ID:[^\]]+\]/)
    if (!match) return { regions: ['GLOBAL'], effectiveFrom: '' }

    const header        = match[0]
    const effectiveFrom = header.match(/EFFECTIVE_FROM:\s*([\d-]+)/)?.[1] ?? ''
    const regionRaw     = header.match(/REGION:\s*([A-Z,\s]+?)(?:\]|$)/)?.[1] ?? 'GLOBAL'
    const regions       = regionRaw.split(',').map(r => r.trim()).filter(Boolean)

    return { regions, effectiveFrom }
}

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initRAG(config: RAGConfig = RAG_DEFAULT) {
    console.log(`Initializing RAG [provider: ${config.embeddingProvider}, model: ${config.embeddingModel}]`)

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize:    config.chunkSize,
        chunkOverlap: config.chunkOverlap,
    })

    const policyDir = join(process.cwd(), 'src/data/policy')
    const files     = readdirSync(policyDir)
    const allDocs: Document[] = []

    for (const file of files) {
        const text     = readFileSync(join(policyDir, file), 'utf-8')
        const metadata = parseHeader(text)
        const docs     = await splitter.createDocuments(
            [text],
            [{
                source:        file,
                regions:       metadata.regions.join(','),   // LangChain Metadata: string
                effectiveFrom: metadata.effectiveFrom,
            }]
        )
        allDocs.push(...docs)
    }

    // Embedding-Provider wählen – eine Stelle, eine Änderung
    // Im Custom Backend waren es embedBatch() + embedQuery() + Client-Initialisierung
    const embeddings = config.embeddingProvider === 'cohere'
        ? new CohereEmbeddings({
            apiKey: process.env.COHERE_API_KEY,
            model:  config.embeddingModel,
        })
        : new OpenAIEmbeddings({
            apiKey: process.env.OPENAI_API_KEY,
            model:  config.embeddingModel,
        })

    vectorStore = await MemoryVectorStore.fromDocuments(allDocs, embeddings)

    console.log(`RAG ready: ${allDocs.length} chunks indexed`)
}

// ── Retrieve ──────────────────────────────────────────────────────────────────
// filter ist optional – ohne Filter verhält sich retrieve() identisch zum Stand aus Szenario A/B
export async function retrieve(
    query:   string,
    topK =   3,
    filter?: RetrievalFilter
): Promise<string[]> {
    if (!vectorStore) throw new Error('RAG not initialized')

    if (filter) {
        // LangChain MemoryVectorStore unterstützt where-Filter auf Metadaten
        // regions ist als kommaseparierter String gespeichert → $contains prüft auf Teilstring
        const whereFilter = (doc: Document) => {
            const regions = (doc.metadata.regions as string ?? '').split(',').map((r: string) => r.trim())
            const regionMatch = regions.includes('GLOBAL') || regions.includes(filter.region.toUpperCase())
            const dateMatch   = !doc.metadata.effectiveFrom || doc.metadata.effectiveFrom <= filter.asOfDate
            return regionMatch && dateMatch
        }

        // MemoryVectorStore: similaritySearch mit Filter-Funktion
        const results = await vectorStore.similaritySearch(query, topK, whereFilter)
        console.log(`Metadata filter [region: ${filter.region}, asOf: ${filter.asOfDate}]: ${results.length} results`)
        return results.map(r => r.pageContent)
    }

    const results = await vectorStore.similaritySearch(query, topK)
    return results.map(r => r.pageContent)
}