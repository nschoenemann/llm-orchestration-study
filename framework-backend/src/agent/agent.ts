import 'dotenv/config'
import { ChatOpenAI }            from '@langchain/openai'
import { ChatAnthropic }         from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import type { BaseChatModel }    from '@langchain/core/language_models/chat_models'

export function getActiveModel(): BaseChatModel {
    const provider = process.env.LLM_PROVIDER ?? 'openai'

    switch (provider) {
        case 'openai':
            return new ChatOpenAI({
                model: 'gpt-5.1',
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