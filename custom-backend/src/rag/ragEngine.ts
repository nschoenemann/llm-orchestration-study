import { readFileSync, readdirSync } from 'fs'
import { join }                      from 'path'
import OpenAI                        from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface Chunk {
    text: string
    source: string
    embedding: number[]
}

let chunks: Chunk[] = []

function cosineSimilarity(a: number[], b: number[]): number {
    const dot      = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magA     = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magB     = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return dot / (magA * magB)
}

async function embed(text: string): Promise<number[]> {
    const res = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text
    })
    return res.data[0].embedding
}

export async function initRAG() {
    const policyDir = join(process.cwd(), 'src/data/policy');
    const files     = readdirSync(policyDir)

    console.log('Initializing RAG...')

    for (const file of files) {
        const text  = readFileSync(join(policyDir, file), 'utf-8')
        const lines = text.split('\n').filter(l => l.trim().length > 0)

        for (const line of lines) {
            const embedding = await embed(line)
            chunks.push({ text: line, source: file, embedding })
        }
    }

    console.log(`RAG ready: ${chunks.length} chunks indexed`)
}

export async function retrieve(query: string, topK = 3): Promise<string[]> {
    const queryEmbedding = await embed(query)

    return chunks
        .map(c => ({ text: c.text, score: cosineSimilarity(queryEmbedding, c.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(c => c.text)
}