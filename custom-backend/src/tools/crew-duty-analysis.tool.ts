import { registerTool } from './toolRegistry'
import { flights }      from '../data/flightStore'

const CREW_DUTY_WARNING  = 11    // Frühwarnschwelle
const CREW_DUTY_CRITICAL = 11.5  // Policy-Grenze OPS-CREW v2

registerTool(
    {
        name: 'get_crew_duty_analysis',
        description: 'Returns crew duty hour violations and warnings for flights. Optionally filter by airline or date. Use this when the user asks about crew compliance or duty hour violations.',
        parameters: {
            type: 'object',
            properties: {
                airline: { type: 'string', description: 'Optional airline code e.g. LH' },
                date:    { type: 'string', description: 'Optional date in YYYY-MM-DD format' }
            },
            required: []
        }
    },
    async (args) => {
        const { airline, date } = args as {
            airline?: string
            date?:    string
        }

        const filtered = flights.filter(f =>
            (airline ? f.airline.toUpperCase() === airline.toUpperCase() : true) &&
            (date    ? f.date === date                                    : true) &&
            f.crew_duty_hours !== null
        )

        if (filtered.length === 0) {
            return { message: 'No flights found for the given criteria' }
        }

        const violations = filtered.filter(f => (f.crew_duty_hours ?? 0) > CREW_DUTY_CRITICAL)
        const warnings   = filtered.filter(f =>
            (f.crew_duty_hours ?? 0) > CREW_DUTY_WARNING &&
            (f.crew_duty_hours ?? 0) <= CREW_DUTY_CRITICAL
        )

        return {
            total_flights:     filtered.length,
            violations:        violations.length,
            warnings:          warnings.length,
            violation_flights: violations.sort((a, b) => (b.crew_duty_hours ?? 0) - (a.crew_duty_hours ?? 0)),
            warning_flights:   warnings.sort((a, b) => (b.crew_duty_hours ?? 0) - (a.crew_duty_hours ?? 0))
        }
    }
)