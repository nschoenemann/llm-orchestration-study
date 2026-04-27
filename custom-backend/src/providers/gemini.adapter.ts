import { GoogleGenerativeAI, SchemaType, type Tool, type Schema } from '@google/generative-ai'
import type { LLMProvider, UnifiedChatRequest, UnifiedChatResponse, Message } from './types'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export class GeminiAdapter implements LLMProvider {
    getName() { return 'gemini' }

    async chat(req: UnifiedChatRequest): Promise<UnifiedChatResponse> {
        const model = genai.getGenerativeModel({
            model: 'gemini-3.1-pro-preview',
            systemInstruction: req.systemPrompt,
            tools: req.tools?.length ? [{
                functionDeclarations: req.tools.map(t => ({
                    name: t.name,
                    description: t.description,
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: Object.fromEntries(
                            Object.entries(t.parameters.properties).map(([key, val]) => [
                                key,
                                {
                                    type: SchemaType[val.type.toUpperCase() as keyof typeof SchemaType],
                                    description: val.description ?? '',
                                    ...(val.type === 'object' && { properties: {} })
                                } as Schema
                            ])
                        ) as Record<string, Schema>,
                        required: t.parameters.required ?? []
                    }
                }))
            }] as Tool[] : undefined
        })

        const history = this.buildHistory(req.messages)
        const lastMessage = req.messages[req.messages.length - 1]
        const chat = model.startChat({ history })
        const res  = await chat.sendMessage(lastMessage.content)
        const part = res.response.candidates?.[0].content.parts[0]

        if (part?.functionCall) {
            return {
                content: null,
                finishReason: 'tool_calls',
                toolCalls: [{
                    id: `gemini-${Date.now()}`,   // ← Gemini hat keine Tool-Call-IDs!
                    name: part.functionCall.name,
                    arguments: part.functionCall.args as Record<string, unknown>
                }]
            }
        }

        return {
            content: res.response.text(),
            finishReason: 'stop'
        }
    }

    private buildHistory(messages: Message[]) {
        return messages.slice(0, -1).map(m => {
            if (m.role === 'tool') {
                return {
                    role: 'function' as const,
                    parts: [{
                        functionResponse: {
                            name: m.toolCallId ?? 'unknown',
                            response: { result: m.content }
                        }
                    }]
                }
            }
            if (m.role === 'assistant' && m.toolCalls) {
                return {
                    role: 'model' as const,
                    parts: m.toolCalls.map(tc => ({
                        functionCall: {
                            name: tc.name,
                            args: tc.arguments
                        }
                    }))
                }
            }
            return {
                role: m.role === 'assistant' ? 'model' as const : 'user' as const,
                parts: [{ text: m.content }]
            }
        })
    }
}