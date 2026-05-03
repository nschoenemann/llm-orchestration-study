import 'dotenv/config'
import * as readline from 'readline'
import './tools/flight.tool'
import './tools/routes-by-origin.tool'
import './tools/routes-by-destination.tool'
import './tools/flight-details.tool'
import { initRAG }        from './rag/ragEngine'
import { runConversation } from './orchestrator/orchestrator'

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
    console.log('\n═══ Flight Assistant CLI ═══')
    console.log('Provider:', process.env.LLM_PROVIDER ?? 'openai')
    console.log('Type "exit" to quit\n')

    while (true) {
        const input = await ask('You: ')

        if (input.toLowerCase() === 'exit') {
            console.log('Goodbye!')
            rl.close()
            break
        }

        if (!input.trim()) continue

        try {
            const answer = await runConversation(input)
            console.log(`\nAssistant: ${answer}\n`)
        } catch (e) {
            console.error('Error:', e)
        }
    }
}

main()