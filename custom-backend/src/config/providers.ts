import { OpenAIAdapter }   from '../providers/openai.adapter'
import { ClaudeAdapter }   from '../providers/claude.adapter'
import { GeminiAdapter }   from '../providers/gemini.adapter'
import { MistralAdapter }  from '../providers/mistral.adapter'
import type { LLMProvider } from '../providers/types'

export function getActiveProvider(): LLMProvider {
    const name = process.env.LLM_PROVIDER ?? 'openai'
    switch (name) {
        case 'openai':  return new OpenAIAdapter()
        case 'claude':  return new ClaudeAdapter()
        case 'gemini':  return new GeminiAdapter()
        case 'mistral': return new MistralAdapter()
        default: throw new Error(`Unknown provider: ${name}`)
    }
}