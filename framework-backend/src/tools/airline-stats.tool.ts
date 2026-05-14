import { tool }    from '@langchain/core/tools'
import { z }       from 'zod'
import { flights } from '../data/flightStore'
import { logTool } from '../logger'

export const getAirlineStatsTool = tool(
    async ({ airline, date }) => {
        logTool(`get_airline_stats – ${JSON.stringify({ airline, date })}`)

        const filtered = flights.filter(f =>
            f.airline.toUpperCase() === airline.toUpperCase() &&
            (date ? f.date === date : true)
        )

        if (filtered.length === 0) {
            return `No flights found for airline: ${airline}`
        }

        const delayed         = filtered.filter(f => (f.delay_minutes ?? 0) > 0)
        const critical        = filtered.filter(f => (f.delay_minutes ?? 0) > 120)
        const crewViolations  = filtered.filter(f => (f.crew_duty_hours ?? 0) > 11.5)
        const crewWarnings    = filtered.filter(f =>
            (f.crew_duty_hours ?? 0) > 11 &&
            (f.crew_duty_hours ?? 0) <= 11.5
        )
        const totalDelay      = delayed.reduce((sum, f) => sum + (f.delay_minutes ?? 0), 0)
        const avgDelay        = delayed.length > 0 ? Math.round(totalDelay / delayed.length) : 0
        const totalPassengers = filtered.reduce((sum, f) => sum + (f.passengers ?? 0), 0)

        return JSON.stringify({
            airline,
            total_flights:     filtered.length,
            total_passengers:  totalPassengers,
            delayed_flights:   delayed.length,
            critical_flights:  critical.length,
            average_delay:     avgDelay,
            crew_violations:   crewViolations.length,
            crew_warnings:     crewWarnings.length,
            compliance_score:  Math.round(((filtered.length - crewViolations.length) / filtered.length) * 100)
        })
    },
    {
        name: 'get_airline_stats',
        description: 'Returns a comprehensive performance report for a given airline including delay statistics, crew compliance and flight count. Use this as a starting point for airline analysis but complement with get_weather_impact for weather analysis.',        schema: z.object({
            airline: z.string().describe('Airline code e.g. LH, AF, BA'),
            date:    z.string().optional().describe('Optional date in YYYY-MM-DD format')
        })
    }
)