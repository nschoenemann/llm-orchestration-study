import 'dotenv/config'
import { ChatOpenAI }                  from '@langchain/openai'
import { ChatAnthropic }               from '@langchain/anthropic'
import { ChatGoogleGenerativeAI }      from '@langchain/google-genai'
import { createReactAgent }            from '@langchain/langgraph/prebuilt'
import { HumanMessage }   from '@langchain/core/messages'
import type { BaseChatModel }          from '@langchain/core/language_models/chat_models'
import { getFlightsTool }              from '../tools/flight.tool'
import { getRoutesByOriginTool }       from '../tools/routes-by-origin.tool'
import { getRoutesByDestinationTool }  from '../tools/routes-by-destination.tool'
import { getFlightDetailsTool }        from '../tools/flight-details.tool'
import { escalateFlightTool }          from '../tools/escalate-flight.tool'
import { retrieve }                    from '../rag/ragChain'
import { logTool } from '../logger'

// Frühwarn-Schwellenwerte
const THRESHOLDS = {
    delay_warning:     90,
    crew_duty_warning: 11
}

export function getActiveModel(): BaseChatModel {
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
    const model = getActiveModel()
    const tools = [
        getFlightsTool,
        getRoutesByOriginTool,
        getRoutesByDestinationTool,
        getFlightDetailsTool,
        escalateFlightTool
    ]

    const ragChunks    = await retrieve(userMessage)
    const systemPrompt = `Du bist ein hilfreicher Flug-Assistent für Mitarbeiter.

Relevante Richtlinien:
${ragChunks.map(c => `- ${c}`).join('\n')}

Beantworte Fragen präzise basierend auf den verfügbaren Tools und Richtlinien.

Wichtig:
- Wenn kein Datum angegeben wurde, suche über ALLE verfügbaren Daten
- Frage nicht nach einem fehlenden Datum
- Das System überwacht intern Frühwarn-Schwellenwerte: Verspätung > ${THRESHOLDS.delay_warning} Min oder Crew-Dienstzeit > ${THRESHOLDS.crew_duty_warning}h
- Bei Überschreitung dieser Schwellenwerte wird automatisch eine Eskalationsprüfung eingeleitet`

    const agent = createReactAgent({
        llm:             model,
        tools,
        messageModifier: systemPrompt
    })

    // Custom Tool-Result-Interceptor für Hybrid-Logik
    const messages: any[] = [new HumanMessage(userMessage)]
    const MAX_ITERATIONS  = 15

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const result = await agent.invoke({ messages })
        const lastMessages = result.messages

        // Letztes Tool-Result prüfen
        const lastToolMsg = [...lastMessages].reverse().find(m => m._getType() === 'tool')
        const lastAiMsg   = lastMessages[lastMessages.length - 1]

        if (!lastToolMsg || lastAiMsg._getType() !== 'tool') {
            // Finale Antwort
            return typeof lastAiMsg.content === 'string'
                ? lastAiMsg.content
                : JSON.stringify(lastAiMsg.content)
        }

        // Escalation Check
        const toolName   = lastToolMsg.name
        const toolResult = JSON.parse(lastToolMsg.content)

        logTool(`${toolName} – ${JSON.stringify(toolResult)}`)

        const escalation = checkEscalationNeeded(toolName, toolResult)

        if (escalation.needed && escalation.data) {
            console.log(`Escalation triggered: ${escalation.reason}`)
            logTool(`ESCALATION TRIGGERED – reason: ${escalation.reason}`)

            const escalationChunks = await retrieve(
                `escalation policy ${escalation.reason} critical flight`, 3
            )
            messages.push(...lastMessages.slice(messages.length))
            messages.push(new HumanMessage(
                `SYSTEM: Frühwarn-Schwellenwert überschritten (${escalation.reason}). ` +
                `Relevante Eskalations-Policies: ${escalationChunks.join(' | ')}`
            ))
        } else {
            messages.push(...lastMessages.slice(messages.length))
        }
    }
    throw new Error('Max iterations reached')
}