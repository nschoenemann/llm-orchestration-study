import { Mistral } from '@mistralai/mistralai'
import type { LLMProvider, UnifiedChatRequest, UnifiedChatResponse, Message } from './types'

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY })

export class MistralAdapter implements LLMProvider {
    getName() { return 'mistral' }

    async chat(req: UnifiedChatRequest): Promise<UnifiedChatResponse> {
        const messages = this.mapMessages(req.messages, req.systemPrompt)

        const tools = req.tools?.map(t => ({
            type: 'function' as const,
            function: {
                name:        t.name,
                description: t.description,
                parameters:  t.parameters
            }
        }))
        console.log('MISTRAL MESSAGES:', JSON.stringify(messages, null, 2))
        const res = await client.chat.complete({
            model:    'mistral-small-latest',
            messages,
            tools: tools?.length ? tools : undefined
        })

        const choice = res.choices?.[0]
        const msg    = choice?.message

        const hasToolCalls = (msg?.toolCalls?.length ?? 0) > 0

        return {
            content:      msg?.content as string | null ?? null,
            finishReason: hasToolCalls ? 'tool_calls' : 'stop',
            toolCalls:    hasToolCalls ? msg?.toolCalls?.map(tc => ({
                id:        tc.id ?? `mistral-${Date.now()}`,
                name:      tc.function.name,
                arguments: typeof tc.function.arguments === 'string'
                    ? JSON.parse(tc.function.arguments)
                    : tc.function.arguments as Record<string, unknown>
            })) : undefined
        }
    }

    // Mistral folgt dem OpenAI Message-Format – kein eigenes Mapping nötig
    private mapMessages(messages: Message[], systemPrompt?: string) {
        const result: any[] = []

        if (systemPrompt) {
            result.push({ role: 'system', content: systemPrompt })
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
                    content: '',
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
                // Nur hinzufügen wenn content nicht leer ist
                if (m.content) {
                    result.push({ role: m.role, content: m.content })
                }
            }
        }

        return result
    }
}