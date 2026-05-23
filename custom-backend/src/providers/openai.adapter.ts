import OpenAI from 'openai'
import type { LLMProvider, UnifiedChatRequest, UnifiedChatResponse, Message } from './types'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Reasoning-Modelle (o-Serie) unterscheiden sich von Chat-Modellen in zwei Punkten:
// 1. System-Prompt wird als 'developer'-Message gesendet, nicht als 'system'
// 2. max_completion_tokens statt max_tokens
const REASONING_MODELS = ['o3', 'o4-mini', 'o3-mini', 'o1']

function isReasoningModel(model: string): boolean {
    return REASONING_MODELS.some(m => model.startsWith(m))
}

export class OpenAIAdapter implements LLMProvider {
    private model: string

    constructor(model = 'gpt-5.1') {
        this.model = model
    }

    getName() { return `openai/${this.model}` }

    async chat(req: UnifiedChatRequest): Promise<UnifiedChatResponse> {
        const reasoning = isReasoningModel(this.model)
        const messages  = this.mapMessages(req.messages, req.systemPrompt, reasoning)

        const tools = req.tools?.map(t => ({
            type: 'function' as const,
            function: {
                name:        t.name,
                description: t.description,
                parameters:  t.parameters
            }
        }))

        const res = await client.chat.completions.create({
            model:    this.model,
            messages,
            tools:    tools?.length ? tools : undefined,
            // Reasoning-Modelle nutzen max_completion_tokens, Chat-Modelle max_tokens
            ...(reasoning
                    ? { max_completion_tokens: 4096 }
                    : {}
            )
        })

        const choice = res.choices[0]
        const msg    = choice.message

        return {
            content:      msg.content,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
            toolCalls:    msg.tool_calls?.map(tc => {
                if (tc.type !== 'function') throw new Error(`Unsupported tool type: ${tc.type}`)
                return {
                    id:        tc.id,
                    name:      tc.function.name,
                    arguments: JSON.parse(tc.function.arguments)
                }
            })
        }
    }

    private mapMessages(messages: Message[], systemPrompt?: string, reasoning = false) {
        const result: any[] = []

        if (systemPrompt) {
            // Reasoning-Modelle: 'developer' statt 'system'
            // Hintergrund: o3/o4-mini unterscheiden zwischen Instruktionen vom Entwickler
            // und Konversations-Kontext — 'developer' signalisiert dass die Instruction
            // vom System kommt, nicht vom Nutzer
            result.push({ role: reasoning ? 'developer' : 'system', content: systemPrompt })
        }

        for (const m of messages) {
            if (m.role === 'tool') {
                result.push({
                    role:         'tool',
                    tool_call_id: m.toolCallId!,
                    content:      m.content
                })
            } else if (m.role === 'assistant' && m.toolCalls) {
                result.push({
                    role:    'assistant',
                    content: null,
                    tool_calls: m.toolCalls.map(tc => ({
                        id:   tc.id,
                        type: 'function',
                        function: {
                            name:      tc.name,
                            arguments: JSON.stringify(tc.arguments)
                        }
                    }))
                })
            } else {
                result.push({ role: m.role, content: m.content })
            }
        }
        return result
    }
}