import 'dotenv/config'
import { ChatOpenAI }                  from '@langchain/openai'
import { ChatAnthropic }               from '@langchain/anthropic'
import { ChatGoogleGenerativeAI }      from '@langchain/google-genai'
import { createReactAgent }            from '@langchain/langgraph/prebuilt'
import { HumanMessage }                from '@langchain/core/messages'
import type { BaseChatModel }          from '@langchain/core/language_models/chat_models'
import { getFlightsTool }              from '../tools/flight.tool'
import { retrieve }                    from '../rag/ragChain'

export function getActiveModel(): BaseChatModel {
    const provider = process.env.LLM_PROVIDER ?? 'openai'

    switch (provider) {
        case 'openai':
            return new ChatOpenAI({
                model: 'gpt-4o',
                apiKey: process.env.OPENAI_API_KEY
            })
        case 'claude':
            return new ChatAnthropic({
                model: 'claude-opus-4-5',
                apiKey: process.env.ANTHROPIC_API_KEY
            })
        case 'gemini':
            return new ChatGoogleGenerativeAI({
                model: 'gemini-3.1-pro-preview',
                apiKey: process.env.GEMINI_API_KEY,
                maxRetries: 1
            })
        default:
            throw new Error(`Unknown provider: ${provider}`)
    }
}

export async function runAgent(userMessage: string): Promise<string> {
    const model = getActiveModel()
    const tools = [getFlightsTool]

    const ragChunks    = await retrieve(userMessage)
    const systemPrompt = `Du bist ein hilfreicher Flug-Assistent.

Relevante Richtlinien:
${ragChunks.map(c => `- ${c}`).join('\n')}

Beantworte Fragen präzise basierend auf den verfügbaren Tools und Richtlinien.`

    const agent = createReactAgent({
        llm:             model,
        tools,
        messageModifier: systemPrompt
    })

    const result = await agent.invoke({
        messages: [new HumanMessage(userMessage)]
    })

    const lastMessage = result.messages[result.messages.length - 1]
    return typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content)
}