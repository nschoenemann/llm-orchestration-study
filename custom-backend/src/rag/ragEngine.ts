// ── RAG Engine: OpenAI File Search ───────────────────────────────────────────
// OpenAI übernimmt Chunking, Embedding, Indexierung und Retrieval vollständig.
// Voraussetzung: setup-vector-store.ts einmalig ausführen,
// VECTOR_STORE_ID in .env eintragen.

export async function initRAG() {
    const vectorStoreId = process.env.VECTOR_STORE_ID
    if (!vectorStoreId) {
        throw new Error(
            'VECTOR_STORE_ID nicht gesetzt. ' +
            'Führe zuerst npx tsx src/scripts/setup-vector-store.ts aus.'
        )
    }
    console.log(`RAG ready: OpenAI File Search [vectorStore: ${vectorStoreId}]`)
}

// Das file_search Tool-Objekt für die Responses API
export function getFileSearchTool(): object {
    return {
        type: 'file_search',
        vector_store_ids: [process.env.VECTOR_STORE_ID!],
    }
}

// Leere Implementierung — Retrieval übernimmt OpenAI intern
export async function retrieve(_query: string, _topK = 3): Promise<string[]> {
    return []
}