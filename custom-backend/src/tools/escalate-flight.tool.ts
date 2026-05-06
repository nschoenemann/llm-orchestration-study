// src/tools/escalate-flight.tool.ts
import { registerTool } from './toolRegistry'
import { retrieve }     from '../rag/ragEngine'

registerTool(
    {
        name: 'escalate_flight',
        description: 'Escalates a flight that meets critical criteria (delay > 120 min, crew duty > 12h). Retrieves relevant escalation policies and returns escalation details. Only call this tool when critical thresholds are met.',
        parameters: {
            type: 'object',
            properties: {
                flight_id:    { type: 'string', description: 'Flight ID to escalate' },
                reason:       { type: 'string', description: 'Reason for escalation: delay, crew_duty, or weather' },
                delay_minutes:{ type: 'number', description: 'Current delay in minutes' },
                crew_duty_hours: { type: 'number', description: 'Current crew duty hours' }
            },
            required: ['flight_id', 'reason']
        }
    },
    async (args) => {
        const { flight_id, reason, delay_minutes, crew_duty_hours } = args as {
            flight_id: string
            reason: string
            delay_minutes?: number
            crew_duty_hours?: number
        }

        // RAG: spezifische Eskalations-Policies laden
        const query = `escalation policy ${reason} flight delay crew duty`
        const policies = await retrieve(query, 5)

        return {
            escalation_id:    `ESC-${Date.now()}`,
            flight_id,
            reason,
            delay_minutes:    delay_minutes ?? null,
            crew_duty_hours:  crew_duty_hours ?? null,
            status:           'escalated',
            relevant_policies: policies,
            timestamp:        new Date().toISOString()
        }
    }
)