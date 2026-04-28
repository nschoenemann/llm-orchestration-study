import 'dotenv/config'
import { HumanMessage } from '@langchain/core/messages'
import { getActiveModel } from './agent/agent'

async function testModels() {
    console.log('\n═══ LANGCHAIN ADAPTER TEST ═══')

    const providers = ['openai', 'claude', 'gemini']

    for (const provider of providers) {
        process.env.LLM_PROVIDER = provider
        const model = getActiveModel()

        try {
            const res = await model.invoke([
                new HumanMessage('Antworte nur mit: OK')
            ])
            console.log(`✓ ${provider}: "${res.content}"`)
        } catch (e) {
            console.error(`✗ ${provider}:`, e)
        }
    }
}

testModels()