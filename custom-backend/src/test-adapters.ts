import 'dotenv/config'   // ← diese Zeile ganz oben hinzufügen

import { OpenAIAdapter }  from './providers/openai.adapter'
import { ClaudeAdapter }  from './providers/claude.adapter'
import { GeminiAdapter }  from './providers/gemini.adapter'
import type { UnifiedChatRequest } from './providers/types'

const request: UnifiedChatRequest = {
    messages: [{ role: 'user', content: 'Antworte nur mit: OK' }],
    systemPrompt: 'Du bist ein Testassistent.'
}

async function testAll() {
    const adapters = [
        new OpenAIAdapter(),
        new ClaudeAdapter(),
        new GeminiAdapter()
    ]

    for (const adapter of adapters) {
        try {
            console.log(`\nTesting ${adapter.getName()}...`)
            const res = await adapter.chat(request)
            console.log(`✓ ${adapter.getName()}: "${res.content}"`)
        } catch (e) {
            console.error(`✗ ${adapter.getName()}:`, e)
        }
    }
}

testAll()