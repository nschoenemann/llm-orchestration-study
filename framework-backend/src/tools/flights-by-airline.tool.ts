import { tool }        from '@langchain/core/tools'
import { z }           from 'zod'
import { flights }     from '../data/flightStore'
import { logTool }     from '../logger'

function getStatus(delay_minutes: number | null): 'on_time' | 'delayed' {
    if (!delay_minutes || delay_minutes === 0) return 'on_time'
    return 'delayed'
}

export const getFlightsByAirlineTool = tool(
    async ({ airline, date }) => {
        logTool(`get_flights_by_airline – ${JSON.stringify({ airline, date })}`)

        const results = flights
            .filter(f =>
                f.airline.toUpperCase() === airline.toUpperCase() &&
                (date ? f.date === date : true)
            )
            .map(f => ({ ...f, status: getStatus(f.delay_minutes) }))

        return results.length > 0
            ? JSON.stringify(results)
            : `No flights found for airline: ${airline}`
    },
    {
        name: 'get_flights_by_airline',
        description: 'Returns all flights for a given airline code. Use this when the user asks about flights operated by a specific airline.',
        schema: z.object({
            airline: z.string().describe('Airline code e.g. LH, AF, BA'),
            date:    z.string().optional().describe('Optional date in YYYY-MM-DD format')
        })
    }
)