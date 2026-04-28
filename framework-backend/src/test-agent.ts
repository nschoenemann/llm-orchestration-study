import 'dotenv/config'
import { initRAG }        from './rag/ragChain'
import { runAgent, getActiveModel } from './agent/agent'
import { HumanMessage }   from '@langchain/core/messages'

async function testModels() {
    console.log('\n═══ 1. MODEL TEST ═══')
    const providers = ['openai', 'claude', 'gemini']

    for (const provider of providers) {
        process.env.LLM_PROVIDER = provider
        const model = getActiveModel()
        try {
            const res = await model.invoke([new HumanMessage('Antworte nur mit: OK')])
            console.log(`✓ ${provider}: "${res.content}"`)
        } catch (e) {
            console.error(`✗ ${provider}:`, e)
        }
    }
}

async function testAgent() {
    console.log('\n═══ 2. AGENT TEST (Tool + RAG) ═══')
    const question = 'Welche Flüge gibt es auf der Route FRA-JFK am 2026-02-25?'

    for (const provider of ['openai', 'claude', 'gemini']) {
        process.env.LLM_PROVIDER = provider
        console.log(`\nTesting ${provider}...`)
        console.log(`Frage: ${question}`)

        try {
            const answer = await runAgent(question)
            console.log(`✓ Antwort: ${answer}`)
        } catch (e) {
            console.error(`✗ Fehler:`, e)
        }
    }
}

async function main() {
    await initRAG()
    await testModels()
    await testAgent()
    console.log('\n═══ DONE ═══')
}

main()