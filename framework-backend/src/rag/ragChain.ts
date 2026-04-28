import { OpenAIEmbeddings }         from '@langchain/openai'
import { MemoryVectorStore }         from 'langchain/vectorstores/memory'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { readFileSync, readdirSync } from 'fs'
import { join }                      from 'path'

let vectorStore: MemoryVectorStore | null = null

export async function initRAG() {
    console.log('Initializing RAG...')

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 100,
        chunkOverlap: 10
    })

    const policyDir = join(process.cwd(), 'src/data/policy')
    const files     = readdirSync(policyDir)
    const allDocs   = []

    for (const file of files) {
        const text = readFileSync(join(policyDir, file), 'utf-8')
        const docs = await splitter.createDocuments(
            [text],
            [{ source: file }]
        )
        allDocs.push(...docs)
    }

    vectorStore = await MemoryVectorStore.fromDocuments(
        allDocs,
        new OpenAIEmbeddings({ model: 'text-embedding-3-small' })
    )

    console.log(`RAG ready: ${allDocs.length} chunks indexed`)
}

export async function retrieve(query: string, topK = 3): Promise<string[]> {
    if (!vectorStore) throw new Error('RAG not initialized')

    const results = await vectorStore.similaritySearch(query, topK)
    return results.map(r => r.pageContent)
}