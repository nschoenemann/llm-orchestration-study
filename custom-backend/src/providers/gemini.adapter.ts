import { GoogleGenerativeAI, SchemaType, type Tool, type Schema } from '@google/generative-ai'
import type { LLMProvider, UnifiedChatRequest, UnifiedChatResponse, Message } from './types'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Gemini-spezifischer Retry-Mechanismus für 503 Service Unavailable
// Preview-Modelle haben eine höhere Instabilitätsrate als stabile Produktionsmodelle
const MAX_RETRIES  = 3
const RETRY_DELAY  = 2000 // ms

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await fn()
        } catch (err: any) {
            const is503 = err?.status === 503 ||
                err?.message?.includes('503') ||
                err?.message?.includes('Service Unavailable') ||
                err?.message?.toLowerCase().includes('overloaded')

            if (is503 && attempt < MAX_RETRIES) {
                console.warn(`Gemini 503 – Retry ${attempt}/${MAX_RETRIES - 1} in ${RETRY_DELAY}ms...`)
                await new Promise(res => setTimeout(res, RETRY_DELAY * attempt))
                continue
            }
            throw err
        }
    }
    throw new Error('Gemini: Max retries reached')
}

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

        const history     = this.buildHistory(req.messages)
        const lastMessage = req.messages[req.messages.length - 1]
        const chat        = model.startChat({ history })

        // Retry-Wrapper fängt 503-Fehler ab ohne den Orchestrator zu berühren
        const res = await withRetry(() => chat.sendMessage(lastMessage.content))

        const candidate = res.response.candidates?.[0]
        const parts     = candidate?.content?.parts ?? []
        const part      = parts.find(p => p.functionCall) ?? parts[0]

        if (part?.functionCall) {
            return {
                content: null,
                finishReason: 'tool_calls',
                toolCalls: [{
                    id:        `gemini-${Date.now()}`,
                    name:      part.functionCall.name,
                    arguments: part.functionCall.args as Record<string, unknown>
                }]
            }
        }

        return {
            content:      res.response.text(),
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
                            name:     m.toolCallId ?? 'unknown',
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
                role:  m.role === 'assistant' ? 'model' as const : 'user' as const,
                parts: [{ text: m.content }]
            }
        })
    }
}