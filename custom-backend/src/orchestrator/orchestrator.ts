import { getActiveProvider }               from '../config/providers'
import { getToolDefinitions, executeTool } from '../tools/toolRegistry'
import { retrieve }                        from '../rag/ragEngine'
import { logTool }                         from '../logger'
import type { Message }                    from '../providers/types'

const MAX_ITERATIONS = 15

// Schwellenwerte
const THRESHOLDS = {
    delay_warning:     90,  // Frühwarnung vor Policy-Grenze (120 Min)
    crew_duty_warning: 11   // Frühwarnung vor Policy-Grenze (11.5h)
}

function checkEscalationNeeded(toolName: string, result: unknown): {
    needed: boolean
    reason?: string
    data?: Record<string, unknown>
} {
    if (toolName !== 'get_flight_details' && toolName !== 'get_flights') {
        return { needed: false }
    }

    const flights = Array.isArray(result) ? result : [result]

    for (const flight of flights) {
        if (!flight || typeof flight !== 'object') continue
        const f = flight as Record<string, unknown>

        if (typeof f.delay_minutes === 'number' && f.delay_minutes > THRESHOLDS.delay_warning) {
            return {
                needed: true,
                reason: 'delay',
                data: {
                    flight_id:       f.flight_id,
                    delay_minutes:   f.delay_minutes,
                    crew_duty_hours: f.crew_duty_hours
                }
            }
        }

        if (typeof f.crew_duty_hours === 'number' && f.crew_duty_hours > THRESHOLDS.crew_duty_warning) {
            return {
                needed: true,
                reason: 'crew_duty',
                data: {
                    flight_id:       f.flight_id,
                    crew_duty_hours: f.crew_duty_hours,
                    delay_minutes:   f.delay_minutes
                }
            }
        }
    }

    return { needed: false }
}

export async function runConversation(
    userMessage: string
): Promise<string> {

    // ── 1. Provider & Tools vorbereiten ──────────────────────────────────────
    const provider = getActiveProvider()
    const tools    = getToolDefinitions()

    // ── 2. RAG: relevante Policy-Chunks laden & System-Prompt aufbauen ────────
    const ragChunks    = await retrieve(userMessage)
    const systemPrompt = `Du bist ein hilfreicher Flug-Assistent für Mitarbeiter.

Relevante Richtlinien:
${ragChunks.map(c => `- ${c}`).join('\n')}

Beantworte Fragen präzise basierend auf den verfügbaren Tools und Richtlinien.

Wichtig:
- Wenn kein Datum angegeben wurde und der Kontext nicht klar macht welches Datum relevant ist, suche über ALLE verfügbaren Daten in der Datenbank
- Frage nicht nach einem fehlenden Datum – versuche stattdessen mit allen verfügbaren Flügen zu arbeiten
- Das System überwacht intern Frühwarn-Schwellenwerte: Verspätung > ${THRESHOLDS.delay_warning} Min oder Crew-Dienstzeit > ${THRESHOLDS.crew_duty_warning}h
- Bei Überschreitung dieser Schwellenwerte wird automatisch eine Eskalationsprüfung eingeleitet – die finale Entscheidung basiert auf den geltenden Policy-Richtlinien`

    // ── 3. Message-History initialisieren ─────────────────────────────────────
    const messages: Message[] = [
        { role: 'user', content: userMessage }
    ]

    // ── 4. Conversation Loop ──────────────────────────────────────────────────
    for (let i = 0; i < MAX_ITERATIONS; i++) {

        // 4a. LLM aufrufen via Provider Abstraction Layer
        const response = await provider.chat({ messages, tools, systemPrompt })

        // 4b. Finale Antwort – kein Tool-Call
        if (response.finishReason === 'stop' || !response.toolCalls?.length) {
            return response.content ?? 'Keine Antwort erhalten'
        }

        // 4c. Assistant-Message mit Tool-Calls in History speichern
        const assistantMessage: Message = {
            role:      'assistant',
            content:   response.content ?? '',
            toolCalls: response.toolCalls
        }
        messages.push(assistantMessage)

        // 4d. Tool-Calls ausführen
        for (const toolCall of response.toolCalls) {
            console.log(`Executing tool: ${toolCall.name}`, toolCall.arguments)
            logTool(`${toolCall.name} – ${JSON.stringify(toolCall.arguments)}`)

            const result = await executeTool(toolCall.name, toolCall.arguments)

            // 4e. Hybrid Escalation Check
            const escalation = checkEscalationNeeded(toolCall.name, result)

            if (escalation.needed && escalation.data) {
                // Eskalation: zweiter RAG-Abruf + Kontext ans LLM
                console.log(`Escalation triggered: ${escalation.reason}`, escalation.data)
                logTool(`ESCALATION TRIGGERED – reason: ${escalation.reason}`)

                const escalationChunks = await retrieve(
                    `escalation policy ${escalation.reason} critical flight`, 3
                )

                messages.push({
                    role:      'tool',
                    content:   JSON.stringify({
                        ...result as object,
                        _escalation_required: true,
                        _escalation_reason:   escalation.reason,
                        _escalation_policies: escalationChunks
                    }),
                    toolCallId: toolCall.id
                })
            } else {
                // Kein Eskalationsbedarf – Tool-Ergebnis direkt zurück
                messages.push({
                    role:      'tool',
                    content:   JSON.stringify(result),
                    toolCallId: toolCall.id
                })
            }
        }
    }

    throw new Error('Max iterations reached')
}