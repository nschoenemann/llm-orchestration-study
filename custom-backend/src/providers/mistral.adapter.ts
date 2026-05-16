import type { LLMProvider, UnifiedChatRequest, UnifiedChatResponse, Message } from './types'

// Direkter REST-Call statt Mistral SDK – umgeht den SDK-Bug mit tool-calling
// in @mistralai/mistralai chat.complete() bei Tool-Results in der History
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

        const body: Record<string, unknown> = {
            model:    'mistral-large-latest',
            messages,
        }
        if (tools?.length) body.tools = tools

        const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
            },
            body: JSON.stringify(body)
        })

        if (!res.ok) {
            const err = await res.text()
            throw new Error(`Mistral API error ${res.status}: ${err}`)
        }

        const data    = await res.json()
        const choice  = data.choices?.[0]
        const msg     = choice?.message
        const hasToolCalls = (msg?.tool_calls?.length ?? 0) > 0

        return {
            content:      msg?.content ?? null,
            finishReason: hasToolCalls ? 'tool_calls' : 'stop',
            toolCalls:    hasToolCalls ? msg.tool_calls.map((tc: any) => ({
                id:        tc.id ?? `mistral-${Date.now()}`,
                name:      tc.function.name,
                arguments: typeof tc.function.arguments === 'string'
                    ? JSON.parse(tc.function.arguments)
                    : tc.function.arguments
            })) : undefined
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
                    role:         'tool',
                    tool_call_id: m.toolCallId!,
                    content:      m.content
                })
            } else if (m.role === 'assistant' && m.toolCalls) {
                result.push({
                    role:       'assistant',
                    content:    '',
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
                if (m.content) {
                    result.push({ role: m.role, content: m.content })
                }
            }
        }

        return result
    }
}