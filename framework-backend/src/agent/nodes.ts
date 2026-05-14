import { SystemMessage, ToolMessage } from '@langchain/core/messages'
import { retrieve }                   from '../rag/ragChain'
import { logTool }                    from '../logger'
import type { AgentState }            from './state'
import {THRESHOLDS} from "../config/thresholds";

export const ROUTES = {
    TOOLS:    'tools',
    END:      'end',
    ESCALATE: 'escalate',
    CANCEL:   'cancel',
    CONTINUE: 'continue'
} as const
// ── Node: LLM aufrufen ────────────────────────────────────────────────────────
export async function callLLMNode(state: AgentState, model: any): Promise<Partial<AgentState>> {
    const response = await model.invoke(state.messages)
    return { messages: [response] }
}

// ── Node: Tools ausführen ─────────────────────────────────────────────────────
export async function executeToolsNode(state: AgentState, tools: any[]): Promise<Partial<AgentState>> {
    const lastMessage = state.messages[state.messages.length - 1] as any
    const toolCalls   = lastMessage.tool_calls ?? []

    let escalation_triggered = false
    let escalation_reason: string | null = null
    let cancellation_needed = false
    const toolMessages = []

    for (const toolCall of toolCalls) {
        const tool   = tools.find(t => t.name === toolCall.name)
        if (!tool) throw new Error(`Unknown tool: ${toolCall.name}`)

        const result = await (tool as any).invoke(toolCall.args)
        const parsed = (() => {
            try { return JSON.parse(result as string) }
            catch { return result }
        })()

        // ── Escalation Check ──────────────────────────────────────────────────
        if (toolCall.name === 'get_flight_details' || toolCall.name === 'get_flights') {
            const flights = Array.isArray(parsed) ? parsed : [parsed]
            for (const f of flights) {
                if (typeof f.delay_minutes === 'number' && f.delay_minutes > THRESHOLDS.delay_warning) {
                    escalation_triggered = true
                    escalation_reason    = 'delay'
                }
                if (typeof f.crew_duty_hours === 'number' && f.crew_duty_hours > THRESHOLDS.crew_duty_warning) {
                    escalation_triggered = true
                    escalation_reason    = 'crew_duty'
                }
            }
        }

        // ── Cancellation Check ────────────────────────────────────────────────
        if (toolCall.name === 'check_cancellation' && parsed.cancellation_required === true) {
            cancellation_needed = true
            logTool(`CANCELLATION TRIGGERED – ${parsed.affected_flights_count} flights affected`)
        }

        toolMessages.push(new ToolMessage({
            content:      JSON.stringify(parsed),
            tool_call_id: toolCall.id ?? ''
        }))
    }

    return {
        messages:             toolMessages,
        escalation_triggered,
        escalation_reason,
        cancellation_needed
    }
}

// ── Node: Eskalation ──────────────────────────────────────────────────────────
export async function handleEscalationNode(state: AgentState): Promise<Partial<AgentState>> {
    logTool(`ESCALATION TRIGGERED – reason: ${state.escalation_reason}`)

    const escalationChunks = await retrieve(
        `escalation policy ${state.escalation_reason} critical flight`, 3
    )

    return {
        messages: [new SystemMessage(
            `SYSTEM: Frühwarn-Schwellenwert überschritten (${state.escalation_reason}). ` +
            `Relevante Eskalations-Policies: ${escalationChunks.join(' | ')}`
        )],
        escalation_triggered: false,
        escalation_reason:    null
    }
}

// ── Node: Cancellation ────────────────────────────────────────────────────────
export async function handleCancellationNode(state: AgentState): Promise<Partial<AgentState>> {
    logTool(`CANCELLATION NODE – initiating cancellation flow`)

    const cancellationChunks = await retrieve(
        'cancellation policy critical weather duration flights', 3
    )

    return {
        messages: [new SystemMessage(
            `SYSTEM: Cancellation-Kriterien erfüllt. ` +
            `Relevante Policies: ${cancellationChunks.join(' | ')}. ` +
            `Bitte cancel_flight für betroffene Flüge aufrufen und danach reassign_crew.`
        )],
        cancellation_needed: false
    }
}

// ── Router: nach Tool-Ausführung ──────────────────────────────────────────────
export function routeAfterTools(state: AgentState): string {
    if (state.cancellation_needed)  return ROUTES.CANCEL
    if (state.escalation_triggered) return ROUTES.ESCALATE
    return ROUTES.CONTINUE
}

// ── Router: nach LLM-Aufruf ───────────────────────────────────────────────────
export function routeAfterLLM(state: AgentState): string {
    const lastMessage = state.messages[state.messages.length - 1] as any
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) return ROUTES.TOOLS
    return ROUTES.END
}