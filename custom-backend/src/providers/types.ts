export interface Message {
    role: 'user' | 'assistant' | 'tool'
    content: string
    toolCallId?: string    // nur bei role: 'tool'
    toolCalls?: ToolCall[] // nur bei role: 'assistant' mit Tool-Call
}

export interface ToolDefinition {
    name: string
    description: string
    parameters: {
        type: 'object'
        properties: Record<string, { type: string; description?: string }>
        required?: string[]
    }
}

export interface ToolCall {
    id: string
    name: string
    arguments: Record<string, unknown>
}

export interface UnifiedChatRequest {
    messages: Message[]
    tools?: ToolDefinition[]
    systemPrompt?: string
}

export interface UnifiedChatResponse {
    content: string | null
    toolCalls?: ToolCall[]
    finishReason: 'stop' | 'tool_calls' | 'error'
}

export interface LLMProvider {
    chat(req: UnifiedChatRequest): Promise<UnifiedChatResponse>
    getName(): string
}