import { registerTool } from './toolRegistry'
import { flights }      from '../data/flightStore'

function getStatus(delay_minutes: number | null): 'on_time' | 'delayed' {
    if (!delay_minutes || delay_minutes === 0) return 'on_time'
    return 'delayed'
}

registerTool(
    {
        name: 'get_flights_by_airline',
        description: 'Returns all flights for a given airline code. Use this when the user asks about flights operated by a specific airline.',
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

        const results = flights
            .filter(f =>
                f.airline.toUpperCase() === airline.toUpperCase() &&
                (date ? f.date === date : true)
            )
            .map(f => ({
                ...f,
                status: getStatus(f.delay_minutes)
            }))

        return results.length > 0
            ? results
            : { message: `No flights found for airline: ${airline}` }
    }
)