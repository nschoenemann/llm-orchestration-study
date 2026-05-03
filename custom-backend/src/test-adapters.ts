import 'dotenv/config'
import './tools/flight.tool'
import './tools/routes-by-origin.tool'
import './tools/routes-by-destination.tool'
import './tools/flight-details.tool'
import { initRAG }          from './rag/ragEngine'
import { runConversation }  from './orchestrator/orchestrator'
import { OpenAIAdapter }    from './providers/openai.adapter'
import { ClaudeAdapter }    from './providers/claude.adapter'
import { GeminiAdapter }    from './providers/gemini.adapter'
import type { UnifiedChatRequest } from './providers/types'

// ── 1. Einfacher Adapter-Test (kein Tool, kein RAG) ──────────────────────────
async function testAdapters() {
    console.log('\n═══ 1. ADAPTER TEST ═══')

    const request: UnifiedChatRequest = {
        messages: [{ role: 'user', content: 'Antworte nur mit: OK' }],
        systemPrompt: 'Du bist ein Testassistent.'
    }

    const adapters = [
        new OpenAIAdapter(),
        new ClaudeAdapter(),
        new GeminiAdapter()
    ]

    for (const adapter of adapters) {
        try {
            const res = await adapter.chat(request)
            console.log(`✓ ${adapter.getName()}: "${res.content}"`)
        } catch (e) {
            console.error(`✗ ${adapter.getName()}:`, e)
        }
    }
}

// ── 2. Orchestrator-Test (mit Tool + RAG) ────────────────────────────────────
async function testOrchestrator() {
    console.log('\n═══ 2. ORCHESTRATOR TEST (Tool + RAG) ═══')

    const providers = ['openai', 'claude', 'gemini']
    const question = 'Welche Flüge gibt es auf der Route FRA-JFK am 2026-02-25?'
    for (const providerName of providers) {
        process.env.LLM_PROVIDER = providerName
        console.log(`\nTesting ${providerName}...`)
        console.log(`Frage: ${question}`)

        try {
            const answer = await runConversation(question)
            console.log(`✓ Antwort: ${answer}`)
        } catch (e) {
            console.error(`✗ Fehler:`, e)
        }
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('Initializing RAG...')
    await initRAG()

    await testAdapters()
    await testOrchestrator()

    console.log('\n═══ DONE ═══')
}

main()