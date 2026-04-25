import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider, UnifiedChatRequest, UnifiedChatResponse, Message } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export class ClaudeAdapter implements LLMProvider {
    getName() { return 'claude' }

    async chat(req: UnifiedChatRequest): Promise<UnifiedChatResponse> {
        const tools = req.tools?.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters   // ← heißt bei Claude input_schema, nicht parameters
        }))

        const res = await client.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 1024,
            system: req.systemPrompt,
            messages: this.mapMessages(req.messages),
            tools: tools?.length ? tools : undefined
        })

        const toolUseBlock = res.content.find(b => b.type === 'tool_use')
        const textBlock    = res.content.find(b => b.type === 'text')

        return {
            content: textBlock?.type === 'text' ? textBlock.text : null,
            finishReason: res.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
            toolCalls: toolUseBlock && toolUseBlock.type === 'tool_use' ? [{
                id: toolUseBlock.id,
                name: toolUseBlock.name,
                arguments: toolUseBlock.input as Record<string, unknown>  // ← Claude liefert Objekt!
            }] : undefined
        }
    }

    private mapMessages(messages: Message[]) {
        const result: any[] = []

        for (const m of messages) {
            if (m.role === 'tool') {
                // Tool-Ergebnisse werden bei Claude als user-Nachricht mit tool_result gesendet
                result.push({
                    role: 'user',
                    content: [{
                        type: 'tool_result',
                        tool_use_id: m.toolCallId!,
                        content: m.content
                    }]
                })
            } else if (m.role === 'assistant' && m.toolCalls) {
                result.push({
                    role: 'assistant',
                    content: m.toolCalls.map(tc => ({
                        type: 'tool_use',
                        id: tc.id,
                        name: tc.name,
                        input: tc.arguments
                    }))
                })
            } else {
                result.push({ role: m.role, content: m.content })
            }
        }
        return result
    }
}