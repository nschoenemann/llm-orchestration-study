// ── RAG Chain: OpenAI File Search ─────────────────────────────────────────────
// Ersetzt die selbst gebaute RAG-Chain durch OpenAI's nativen File Search.
// OpenAI übernimmt Chunking, Embedding, Indexierung und Retrieval vollständig.
//
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

// Leere Implementierung — Retrieval übernimmt OpenAI intern via file_search Tool
export async function retrieve(_query: string, _topK = 3): Promise<string[]> {
    return []
}