import OpenAI from 'openai'
import type { LLMProvider, UnifiedChatRequest, UnifiedChatResponse, Message } from './types'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export class OpenAIAdapter implements LLMProvider {
    getName() { return 'openai' }

    async chat(req: UnifiedChatRequest): Promise<UnifiedChatResponse> {
        const messages = this.mapMessages(req.messages, req.systemPrompt)

        const tools = req.tools?.map(t => ({
            type: 'function' as const,
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }
        }))

        const res = await client.chat.completions.create({
            model: 'gpt-4o',
            messages,
            tools: tools?.length ? tools : undefined
        })

        const choice = res.choices[0]
        const msg = choice.message

        return {
            content: msg.content,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
            toolCalls: msg.tool_calls?.map(tc => {
                if (tc.type !== 'function') throw new Error(`Unsupported tool type: ${tc.type}`)
                return {
                    id: tc.id,
                    name: tc.function.name,
                    arguments: JSON.parse(tc.function.arguments)
                }
            })
        }
    }

    private mapMessages(messages: Message[], systemPrompt?: string) {
        const result: any[] = []

        if (systemPrompt) {
            result.push({ role: 'system', content: systemPrompt })
        }

        for (const m of messages) {
            if (m.role === 'tool') {
                result.push({
                    role: 'tool',
                    tool_call_id: m.toolCallId!,
                    content: m.content
                })
            } else if (m.role === 'assistant' && m.toolCalls) {
                result.push({
                    role: 'assistant',
                    content: null,
                    tool_calls: m.toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.arguments)  // ← zurück zu String für History
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