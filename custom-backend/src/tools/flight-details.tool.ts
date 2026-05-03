import { readFileSync } from 'fs'
import { join }         from 'path'
import { registerTool } from './toolRegistry'

interface Flight {
    flight_id:       string
    airline:         string
    region:          string
    date:            string
    route:           string
    delay_minutes:   number | null
    crew_duty_hours: number | null
    weather:         string | null
}

const flights: Flight[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/flights.json'), 'utf-8')
)

registerTool(
    {
        name: 'get_flight_details',
        description: 'Returns detailed information about a specific flight by its ID',
        parameters: {
            type: 'object',
            properties: {
                flight_id: { type: 'string', description: 'The unique flight identifier, e.g. IB199' }
            },
            required: ['flight_id']
        }
    },
    async (args) => {
        const { flight_id } = args as { flight_id: string }
        const flight = flights.find(f => f.flight_id.toUpperCase() === flight_id.toUpperCase())
        return flight ?? { message: `No flight found with ID: ${flight_id}` }
    }
)