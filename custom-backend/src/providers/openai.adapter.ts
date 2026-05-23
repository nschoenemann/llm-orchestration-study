import OpenAI from 'openai'
import { getFileSearchTool } from '../rag/ragEngine'
import type { LLMProvider, UnifiedChatRequest, UnifiedChatResponse, Message } from './types'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

        // Function Tools für eigene System-Tools
        const functionTools = req.tools?.map(t => ({
            type: 'function' as const,
            name:        t.name,
            description: t.description,
            parameters:  t.parameters,
        })) ?? []

        // file_search via Responses API — unterstützt beide Tool-Typen
        const allTools = [
            ...functionTools,
            getFileSearchTool(),
        ]

        // Responses API nutzt 'input' statt 'messages' und 'instructions' statt 'system'
        const input = this.mapMessages(req.messages)

        const res = await (client as any).responses.create({
            model:        this.model,
            instructions: req.systemPrompt,
            input,
            tools:        allTools,
            ...(reasoning ? { max_output_tokens: 4096 } : {})
        })

        // Responses API Response-Format auswerten
        const output     = res.output ?? []
        const textItem   = output.find((o: any) => o.type === 'message')
        const content    = textItem?.content?.find((c: any) => c.type === 'output_text')?.text ?? null

        // Function Tool Calls extrahieren
        const toolCallItems = output.filter((o: any) => o.type === 'function_call')
        const hasToolCalls  = toolCallItems.length > 0

        return {
            content,
            finishReason: hasToolCalls ? 'tool_calls' : 'stop',
            toolCalls: hasToolCalls ? toolCallItems.map((tc: any) => ({
                id:        tc.call_id,
                name:      tc.name,
                arguments: typeof tc.arguments === 'string'
                    ? JSON.parse(tc.arguments)
                    : tc.arguments
            })) : undefined
        }
    }

    private mapMessages(messages: Message[]) {
        return messages.map(m => {
            if (m.role === 'tool') {
                return {
                    type:        'function_call_output',
                    call_id:     m.toolCallId!,
                    output:      m.content,
                }
            } else if (m.role === 'assistant' && m.toolCalls) {
                return m.toolCalls.map(tc => ({
                    type:      'function_call',
                    call_id:   tc.id,
                    name:      tc.name,
                    arguments: JSON.stringify(tc.arguments),
                }))
            } else {
                return {
                    role:    m.role,
                    content: m.content,
                }
            }
        }).flat()
    }
}