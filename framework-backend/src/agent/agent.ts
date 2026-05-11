import 'dotenv/config'
import { ChatOpenAI }                  from '@langchain/openai'
import { ChatAnthropic }               from '@langchain/anthropic'
import { ChatGoogleGenerativeAI }      from '@langchain/google-genai'
import {BaseMessage, HumanMessage, SystemMessage, ToolMessage} from '@langchain/core/messages'
import { getFlightsTool }              from '../tools/flight.tool'
import { getRoutesByOriginTool }       from '../tools/routes-by-origin.tool'
import { getRoutesByDestinationTool }  from '../tools/routes-by-destination.tool'
import { getFlightDetailsTool }        from '../tools/flight-details.tool'
import { escalateFlightTool }          from '../tools/escalate-flight.tool'
import { retrieve }                    from '../rag/ragChain'
import { logTool }                     from '../logger'
import { LoggingCallbackHandler } from '../callbacks/logging.callback'

const THRESHOLDS = {
    delay_warning:     90,
    crew_duty_warning: 11
}
type ToolCapableModel = ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI

export function getActiveModel(): ToolCapableModel {
    const provider = process.env.LLM_PROVIDER ?? 'openai'
    switch (provider) {
        case 'openai':
            return new ChatOpenAI({
                model:  'gpt-4o',
                apiKey: process.env.OPENAI_API_KEY
            })
        case 'claude':
            return new ChatAnthropic({
                model:  'claude-opus-4-5',
                apiKey: process.env.ANTHROPIC_API_KEY
            })
        case 'gemini':
            return new ChatGoogleGenerativeAI({
                model:      'gemini-3.1-pro-preview',
                apiKey:     process.env.GEMINI_API_KEY,
                maxRetries: 1
            })
        default:
            throw new Error(`Unknown provider: ${provider}`)
    }
}

function checkEscalationNeeded(toolName: string, result: unknown): {
    needed:  boolean
    reason?: string
    data?:   Record<string, unknown>
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

export async function runAgent(userMessage: string): Promise<string> {

    // ── 1. Provider & Tools vorbereiten ──────────────────────────────────────
    const tools          = [getFlightsTool, getRoutesByOriginTool, getRoutesByDestinationTool, getFlightDetailsTool, escalateFlightTool]
    const model          = getActiveModel()
    const modelWithTools = model.bindTools(tools)

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
    const messages: BaseMessage[] = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userMessage)
    ]

    // ── 4. Conversation Loop ──────────────────────────────────────────────────
    const MAX_ITERATIONS = 15

    for (let i = 0; i < MAX_ITERATIONS; i++) {

        // 4a. LLM aufrufen
        const response = await modelWithTools.invoke(messages, {
            callbacks: [new LoggingCallbackHandler()]
        })
        messages.push(response)

        // 4b. Finale Antwort – kein Tool-Call
        if (!response.tool_calls || response.tool_calls.length === 0) {
            return typeof response.content === 'string'
                ? response.content
                : JSON.stringify(response.content)
        }

        // 4c. Tool-Calls ausführen
        for (const toolCall of response.tool_calls) {
            const tool = tools.find(t => t.name === toolCall.name)
            if (!tool) throw new Error(`Unknown tool: ${toolCall.name}`)

            const result = await (tool as any).invoke(toolCall.args, {
                callbacks: [new LoggingCallbackHandler()]
            })
            const parsed = (() => {
                try { return JSON.parse(result as string) }
                catch { return result }
            })()

            // 4d. Hybrid Escalation Check
            const escalation = checkEscalationNeeded(toolCall.name, parsed)

            if (escalation.needed && escalation.data) {
                // Eskalation: zweiter RAG-Abruf + Kontext ans LLM
                logTool(`ESCALATION TRIGGERED – reason: ${escalation.reason}`)
                const escalationChunks = await retrieve(
                    `escalation policy ${escalation.reason} critical flight`, 3
                )
                messages.push(new ToolMessage({
                    content: JSON.stringify({
                        ...parsed,
                        _escalation_required: true,
                        _escalation_reason:   escalation.reason,
                        _escalation_policies: escalationChunks
                    }),
                    tool_call_id: toolCall.id ?? ''
                }))
            } else {
                // Kein Eskalationsbedarf – Tool-Ergebnis direkt zurück
                messages.push(new ToolMessage({
                    content:      JSON.stringify(parsed),
                    tool_call_id: toolCall.id ?? ''
                }))
            }
        }
    }

    throw new Error('Max iterations reached')
}