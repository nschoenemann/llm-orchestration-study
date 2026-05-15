import { tool }                          from '@langchain/core/tools'
import { z }                             from 'zod'
import { retrieve, RetrievalFilter }     from '../rag/ragChain'
import { flights }                       from '../data/flightStore'
import { regions }                       from '../data/regionStore'

// Region aus Route ableiten via regionStore
// Dieselbe Logik wie in flights-by-region.tool.ts und check-cancellation.tool.ts
function getRegionFromRoute(route: string): string | undefined {
    const [origin] = route.split('-')
    return regions.find(r => r.airports.includes(origin))?.region_id
}

export const escalateFlightTool = tool(
    async ({ flight_id, reason, delay_minutes, crew_duty_hours }) => {
        // Route nachschlagen um Region für Metadaten-Filter zu bestimmen
        const flight   = flights.find(f => f.flight_id.toUpperCase() === flight_id.toUpperCase())
        const region   = flight ? getRegionFromRoute(flight.route) : undefined
        const asOfDate = new Date().toISOString().split('T')[0]

        const filter: RetrievalFilter | undefined = region
            ? { region, asOfDate }
            : undefined

        const query    = `escalation policy ${reason} critical flight`
        const policies = await retrieve(query, 5, filter)

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