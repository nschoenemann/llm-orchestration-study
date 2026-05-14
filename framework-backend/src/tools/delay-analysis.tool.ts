import { tool }    from '@langchain/core/tools'
import { z }       from 'zod'
import { flights } from '../data/flightStore'
import { logTool } from '../logger'

export const getDelayAnalysisTool = tool(
    async ({ airline, date, min_delay_minutes }) => {
        logTool(`get_delay_analysis – ${JSON.stringify({ airline, date, min_delay_minutes })}`)

        const threshold = min_delay_minutes ?? 0

        const filtered = flights.filter(f =>
            (airline ? f.airline.toUpperCase() === airline.toUpperCase() : true) &&
            (date    ? f.date === date                                    : true) &&
            (f.delay_minutes !== null && f.delay_minutes >= threshold)
        )

        if (filtered.length === 0) {
            return 'No delayed flights found for the given criteria'
        }

        const totalDelay = filtered.reduce((sum, f) => sum + (f.delay_minutes ?? 0), 0)
        const avgDelay   = Math.round(totalDelay / filtered.length)
        const maxDelay   = Math.max(...filtered.map(f => f.delay_minutes ?? 0))
        const critical   = filtered.filter(f => (f.delay_minutes ?? 0) > 120)

        return JSON.stringify({
            total_flights:    filtered.length,
            average_delay:    avgDelay,
            max_delay:        maxDelay,
            critical_flights: critical.length,
            flights:          filtered.sort((a, b) => (b.delay_minutes ?? 0) - (a.delay_minutes ?? 0))
        })
    },
    {
        name: 'get_delay_analysis',
        description: 'Returns delay statistics and critically delayed flights. Optionally filter by airline or date. If no date is specified, searches across ALL dates in the database. Never invent a date that was not explicitly provided by the user.',        schema: z.object({
            airline:           z.string().optional().describe('Optional airline code e.g. LH'),
            date:              z.string().optional().describe('Optional date in YYYY-MM-DD format'),
            min_delay_minutes: z.number().optional().describe('Optional minimum delay threshold in minutes')
        })
    }
)