import { registerTool } from './toolRegistry'
import { flights }      from '../data/flightStore'

registerTool(
    {
        name: 'get_airline_stats',
        description: 'Returns a performance report for a given airline including delay statistics, crew compliance and flight count. Use this when the user asks about airline performance or compliance overview.',
        parameters: {
            type: 'object',
            properties: {
                airline: { type: 'string', description: 'Airline code e.g. LH, AF, BA' },
                date:    { type: 'string', description: 'Optional date in YYYY-MM-DD format' }
            },
            required: ['airline']
        }
    },
    async (args) => {
        const { airline, date } = args as { airline: string; date?: string }

        const filtered = flights.filter(f =>
            f.airline.toUpperCase() === airline.toUpperCase() &&
            (date ? f.date === date : true)
        )

        if (filtered.length === 0) {
            return { message: `No flights found for airline: ${airline}` }
        }

        const delayed        = filtered.filter(f => (f.delay_minutes ?? 0) > 0)
        const critical       = filtered.filter(f => (f.delay_minutes ?? 0) > 120)
        const crewViolations = filtered.filter(f => (f.crew_duty_hours ?? 0) > 11.5)
        const crewWarnings   = filtered.filter(f =>
            (f.crew_duty_hours ?? 0) > 11 &&
            (f.crew_duty_hours ?? 0) <= 11.5
        )
        const totalDelay     = delayed.reduce((sum, f) => sum + (f.delay_minutes ?? 0), 0)
        const avgDelay       = delayed.length > 0 ? Math.round(totalDelay / delayed.length) : 0
        const totalPassengers = filtered.reduce((sum, f) => sum + (f.passengers ?? 0), 0)

        return {
            airline,
            total_flights:        filtered.length,
            total_passengers:     totalPassengers,
            delayed_flights:      delayed.length,
            critical_flights:     critical.length,
            average_delay:        avgDelay,
            crew_violations:      crewViolations.length,
            crew_warnings:        crewWarnings.length,
            compliance_score:     Math.round(((filtered.length - crewViolations.length) / filtered.length) * 100)
        }
    }
)