import { readFileSync, readdirSync } from 'fs'
import { join }                      from 'path'
import OpenAI                        from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface Chunk {
    text:      string
    source:    string
    embedding: number[]
}

let chunks: Chunk[] = []

// ── Chunking ────────────────────────────────────────────────────────────────
function splitIntoChunks(text: string, chunkSize = 100, chunkOverlap = 10): string[] {
    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
        const end    = Math.min(start + chunkSize, text.length)
        const chunk  = text.slice(start, end).trim()
        if (chunk.length > 0) chunks.push(chunk)
        start += chunkSize - chunkOverlap   // Overlap berücksichtigen
    }

    return chunks
}

// ── Embedding ───────────────────────────────────────────────────────────────
async function embedBatch(texts: string[]): Promise<number[][]> {
    const res = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts                        // Batch statt sequenziell
    })
    return res.data.map(d => d.embedding)
}

// ── Cosine Similarity ───────────────────────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
    const dot  = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return dot / (magA * magB)
}

// ── Init ────────────────────────────────────────────────────────────────────
export async function initRAG() {
    console.log('Initializing RAG...')

    const policyDir = join(process.cwd(), 'src/data/policy')
    const files     = readdirSync(policyDir)
    const allChunks: { text: string; source: string }[] = []

    for (const file of files) {
        const text     = readFileSync(join(policyDir, file), 'utf-8')
        const splitted = splitIntoChunks(text, 500, 50)
        for (const chunk of splitted) {
            allChunks.push({ text: chunk, source: file })
        }
    }

    // Batch Embedding – ein API-Call für alle Chunks
    const embeddings = await embedBatch(allChunks.map(c => c.text))

    chunks = allChunks.map((c, i) => ({
        text:      c.text,
        source:    c.source,
        embedding: embeddings[i]
    }))

    console.log(`RAG ready: ${chunks.length} chunks indexed`)
}

// ── Retrieve ─────────────────────────────────────────────────────────────────
export async function retrieve(query: string, topK = 3): Promise<string[]> {
    const [queryEmbedding] = await embedBatch([query])

    return chunks
        .map(c => ({ text: c.text, score: cosineSimilarity(queryEmbedding, c.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(c => c.text)
}