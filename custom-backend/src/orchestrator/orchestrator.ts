import { getActiveProvider }               from '../config/providers'
import { getToolDefinitions, executeTool } from '../tools/toolRegistry'
import { retrieve }                        from '../rag/ragEngine'
import type { Message }                    from '../providers/types'
import {logTool} from "../logger";

const MAX_ITERATIONS = 15

export async function runConversation(
    userMessage: string,
    history: Message[] = []
): Promise<string> {
    const provider = getActiveProvider()
    const tools    = getToolDefinitions()

    // RAG: relevante Policy-Chunks laden
    const ragChunks  = await retrieve(userMessage)
    const systemPrompt = `Du bist ein hilfreicher Flug-Assistent für Mitarbeiter und Kunden.
  
Relevante Richtlinien:
${ragChunks.map(c => `- ${c}`).join('\n')}

Beantworte Fragen präzise basierend auf den verfügbaren Tools und Richtlinien.

Wichtig:
- Wenn kein Datum angegeben wurde und der Kontext nicht klar macht welches Datum relevant ist, suche über ALLE verfügbaren Daten in der Datenbank
- Frage nicht nach einem fehlenden Datum – versuche stattdessen mit allen verfügbaren Flügen zu arbeiten`

    const messages: Message[] = [
        ...history,
        { role: 'user', content: userMessage }
    ]

    // Conversation Loop
    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const response = await provider.chat({ messages, tools, systemPrompt })

        if (response.finishReason === 'stop' || !response.toolCalls?.length) {
            return response.content ?? 'Keine Antwort erhalten'
        }

        // Tool Calls ausführen
        const assistantMessage: Message = {
            role: 'assistant',
            content: response.content ?? '',
            toolCalls: response.toolCalls
        }
        messages.push(assistantMessage)

        for (const toolCall of response.toolCalls) {
            console.log(`Executing tool: ${toolCall.name}`, toolCall.arguments)
            logTool(`${toolCall.name} – ${JSON.stringify(toolCall.arguments)}`)
            const result = await executeTool(toolCall.name, toolCall.arguments)

            messages.push({
                role: 'tool',
                content: JSON.stringify(result),
                toolCallId: toolCall.id
            })
        }
        // Loop weiter → Modell bekommt Tool-Ergebnis
    }

    throw new Error('Max iterations reached')
}