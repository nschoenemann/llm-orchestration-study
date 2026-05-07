import 'dotenv/config'
import * as readline              from 'readline'
import { initRAG }                from './rag/ragChain'
import { runAgent }               from './agent/agent'
import { logUser, logAssistant, logTool, saveSession, setScenario } from './logger'

const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout
})

function ask(question: string): Promise<string> {
    return new Promise(resolve => rl.question(question, resolve))
}

async function main() {
    console.log('Initializing RAG...')
    await initRAG()

    const scenario = process.argv[2] ?? 'unknown'
    setScenario(scenario)

    console.log('\n═══ Flight Assistant CLI (Framework) ═══')
    console.log('Provider:', process.env.LLM_PROVIDER ?? 'openai')
    console.log('Scenario:', scenario)
    console.log('Type "exit" to quit\n')

    while (true) {
        const input = await ask('You: ')

        if (input.toLowerCase() === 'exit') {
            saveSession()
            rl.close()
            break
        }

        if (!input.trim()) continue

        logUser(input)

        try {
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout after 30s')), 30000)
            )

            const answer = await Promise.race([
                runAgent(input),
                timeoutPromise
            ])

            logAssistant(answer as string)
            console.log(`\nAssistant: ${answer}\n`)
        } catch (e) {
            if (e instanceof Error && e.message.includes('timeout')) {
                console.error('\n✗ Timeout – Provider hat nicht geantwortet\n')
                logTool('ERROR: Request timeout after 30s')
            } else {
                console.error('Error:', e)
            }
        }
    }
}

main()