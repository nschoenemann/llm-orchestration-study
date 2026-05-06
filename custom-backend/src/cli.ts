import 'dotenv/config'
import * as readline          from 'readline'
import './tools/flight.tool'
import './tools/routes-by-origin.tool'
import './tools/routes-by-destination.tool'
import './tools/flight-details.tool'
import { initRAG }            from './rag/ragEngine'
import { runConversation }    from './orchestrator/orchestrator'
import { logUser, logAssistant, saveSession, setScenario } from './logger'
import './tools/escalate-flight.tool'

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

    console.log('\n═══ Flight Assistant CLI ═══')
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
                runConversation(input),
                timeoutPromise
            ])

            logAssistant(answer as string)
            console.log(`\nAssistant: ${answer}\n`)
        } catch (e) {
            if (e instanceof Error && e.message.includes('timeout')) {
                console.error('\n✗ Timeout – Provider hat nicht geantwortet\n')
                logAssistant('ERROR: Request timeout after 30s')
            } else {
                console.error('Error:', e)
            }
        }
    }
}

main()