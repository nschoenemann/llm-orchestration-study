import { tool }     from '@langchain/core/tools'
import { z }        from 'zod'
import { retrieve } from '../rag/ragChain'

export const escalateFlightTool = tool(
    async ({ flight_id, reason, delay_minutes, crew_duty_hours }) => {
        const query    = `escalation policy ${reason} critical flight`
        const policies = await retrieve(query, 3)

        return JSON.stringify({
            escalation_id:     `ESC-${Date.now()}`,
            flight_id,
            reason,
            delay_minutes:     delay_minutes ?? null,
            crew_duty_hours:   crew_duty_hours ?? null,
            status:            'escalated',
            relevant_policies: policies,
            timestamp:         new Date().toISOString()
        })
    },
    {
        name: 'escalate_flight',
        description: 'Escalates a flight that meets critical criteria. Only call when critical thresholds are met.',
        schema: z.object({
            flight_id:       z.string().describe('Flight ID to escalate'),
            reason:          z.string().describe('Reason: delay, crew_duty, or weather'),
            delay_minutes:   z.number().optional().describe('Current delay in minutes'),
            crew_duty_hours: z.number().optional().describe('Current crew duty hours')
        })
    }
)