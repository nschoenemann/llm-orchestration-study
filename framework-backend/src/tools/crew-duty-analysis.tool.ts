import { tool }    from '@langchain/core/tools'
import { z }       from 'zod'
import { flights } from '../data/flightStore'
import { logTool } from '../logger'

const CREW_DUTY_WARNING  = 11
const CREW_DUTY_CRITICAL = 11.5

export const getCrewDutyAnalysisTool = tool(
    async ({ airline, date }) => {
        logTool(`get_crew_duty_analysis – ${JSON.stringify({ airline, date })}`)

        const filtered = flights.filter(f =>
            (airline ? f.airline.toUpperCase() === airline.toUpperCase() : true) &&
            (date    ? f.date === date                                    : true) &&
            f.crew_duty_hours !== null
        )

        if (filtered.length === 0) {
            return 'No flights found for the given criteria'
        }

        const violations = filtered.filter(f => (f.crew_duty_hours ?? 0) > CREW_DUTY_CRITICAL)
        const warnings   = filtered.filter(f =>
            (f.crew_duty_hours ?? 0) > CREW_DUTY_WARNING &&
            (f.crew_duty_hours ?? 0) <= CREW_DUTY_CRITICAL
        )

        return JSON.stringify({
            total_flights:     filtered.length,
            violations:        violations.length,
            warnings:          warnings.length,
            violation_flights: violations.sort((a, b) => (b.crew_duty_hours ?? 0) - (a.crew_duty_hours ?? 0)),
            warning_flights:   warnings.sort((a, b) => (b.crew_duty_hours ?? 0) - (a.crew_duty_hours ?? 0))
        })
    },
    {
        name: 'get_crew_duty_analysis',
        description: 'Returns crew duty hour violations and warnings for flights. Optionally filter by airline or date.',
        schema: z.object({
            airline: z.string().optional().describe('Optional airline code e.g. LH'),
            date:    z.string().optional().describe('Optional date in YYYY-MM-DD format')
        })
    }
)