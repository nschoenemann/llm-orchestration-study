import { readFileSync, readdirSync } from 'fs'
import { join }                      from 'path'
import OpenAI                        from 'openai'

// ── RAG Configuration ─────────────────────────────────────────────────────────
export interface RAGConfig {
    chunkSize:      number
    chunkOverlap:   number
    embeddingModel: string
}

export const RAG_DEFAULT: RAGConfig = {
    chunkSize:      500,
    chunkOverlap:   50,
    embeddingModel: 'text-embedding-3-small',
}

// ── Metadaten ─────────────────────────────────────────────────────────────────
// Wird aus dem Policy-Header gelesen:
// [POLICY_ID: OPS-DELAY | VERSION: v2 | EFFECTIVE_FROM: 2026-01-01 | REGION: EU]
// [POLICY_ID: OPS-DELAY | VERSION: v3 | EFFECTIVE_FROM: 2025-01-01 | REGION: ME, EU]
interface ChunkMetadata {
    regions:       string[]  // z.B. ['EU'], ['ME', 'EU'], ['GLOBAL']
    effectiveFrom: string    // ISO-Datum oder ''
}

export interface RetrievalFilter {
    region:    string   // z.B. 'EU' – matched auf exakte Region + GLOBAL
    asOfDate:  string   // ISO-Datum – schließt noch nicht gültige Policies aus
}

// ── Interner Zustand ──────────────────────────────────────────────────────────
interface Chunk {
    text:      string
    source:    string
    metadata:  ChunkMetadata
    embedding: number[]
}

let chunks: Chunk[]         = []
let activeConfig: RAGConfig = RAG_DEFAULT
let openaiClient: OpenAI

// ── Policy-Header parsen ──────────────────────────────────────────────────────
function parseHeader(text: string): ChunkMetadata {
    const match = text.match(/\[POLICY_ID:[^\]]+\]/)
    if (!match) return { regions: ['GLOBAL'], effectiveFrom: '' }

    const header        = match[0]
    const effectiveFrom = header.match(/EFFECTIVE_FROM:\s*([\d-]+)/)?.[1] ?? ''

    // REGION kann mehrere Werte haben: REGION: ME, EU
    const regionRaw = header.match(/REGION:\s*([A-Z,\s]+?)(?:\]|$)/)?.[1] ?? 'GLOBAL'
    const regions   = regionRaw.split(',').map(r => r.trim()).filter(Boolean)

    return { regions, effectiveFrom }
}

// ── Metadaten-Filter ──────────────────────────────────────────────────────────
function matchesFilter(metadata: ChunkMetadata, filter: RetrievalFilter): boolean {
    // GLOBAL-Policies gelten immer
    // Regionsspezifische Policies gelten wenn die gesuchte Region in der Liste ist
    const regionMatch =
        metadata.regions.includes('GLOBAL') ||
        metadata.regions.includes(filter.region.toUpperCase())

    // Policies die noch nicht in Kraft sind werden ausgeschlossen
    const dateMatch =
        metadata.effectiveFrom === '' ||
        metadata.effectiveFrom <= filter.asOfDate

    return regionMatch && dateMatch
}

// ── Chunking ──────────────────────────────────────────────────────────────────
function splitIntoChunks(text: string, chunkSize: number, chunkOverlap: number): string[] {
    const result: string[] = []
    let start = 0
    while (start < text.length) {
        const end   = Math.min(start + chunkSize, text.length)
        const chunk = text.slice(start, end).trim()
        if (chunk.length > 0) result.push(chunk)
        start += chunkSize - chunkOverlap
    }
    return result
}

// ── Embedding ─────────────────────────────────────────────────────────────────
async function embedBatch(texts: string[]): Promise<number[][]> {
    const res = await openaiClient.embeddings.create({
        model: activeConfig.embeddingModel,
        input: texts,
    })
    return res.data.map(d => d.embedding)
}

// ── Cosine Similarity ─────────────────────────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
    const dot  = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return dot / (magA * magB)
}

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initRAG(config: RAGConfig = RAG_DEFAULT) {
    activeConfig = config
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    console.log(`Initializing RAG [model: ${config.embeddingModel}, chunkSize: ${config.chunkSize}, overlap: ${config.chunkOverlap}]`)

    const policyDir = join(process.cwd(), 'src/data/policy')
    const files     = readdirSync(policyDir)
    const allChunks: { text: string; source: string; metadata: ChunkMetadata }[] = []

    for (const file of files) {
        const text     = readFileSync(join(policyDir, file), 'utf-8')
        const metadata = parseHeader(text)
        const splitted = splitIntoChunks(text, config.chunkSize, config.chunkOverlap)
        for (const chunk of splitted) {
            allChunks.push({ text: chunk, source: file, metadata })
        }
    }

    const embeddings = await embedBatch(allChunks.map(c => c.text))

    chunks = allChunks.map((c, i) => ({
        text:      c.text,
        source:    c.source,
        metadata:  c.metadata,
        embedding: embeddings[i],
    }))

    console.log(`RAG ready: ${chunks.length} chunks indexed`)
}

// ── Retrieve ──────────────────────────────────────────────────────────────────
export async function retrieve(
    query:   string,
    topK =   3,
    filter?: RetrievalFilter
): Promise<string[]> {
    const [queryEmbedding] = await embedBatch([query])

    const candidates = filter
        ? chunks.filter(c => matchesFilter(c.metadata, filter))
        : chunks

    if (filter) {
        console.log(`Metadata filter [region: ${filter.region}, asOf: ${filter.asOfDate}]: ${candidates.length}/${chunks.length} chunks`)
    }

    return candidates
        .map(c => ({ text: c.text, score: cosineSimilarity(queryEmbedding, c.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(c => c.text)
}