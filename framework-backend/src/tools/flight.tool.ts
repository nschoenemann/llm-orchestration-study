import { tool }         from '@langchain/core/tools'
import { z }            from 'zod'
import { readFileSync } from 'fs'
import { join }         from 'path'

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

export const getFlightsTool = tool(
    async ({ route, date }) => {
        const results = flights.filter(f =>
            f.route?.toUpperCase() === route.toUpperCase() &&
            f.date === date
        )
        return results.length > 0
            ? JSON.stringify(results)
            : 'No flights found'
    },
    {
        name: 'get_flights',
        description: 'Returns available flights for a given route and date. Route format is ORIGIN-DESTINATION in IATA codes, e.g. FRA-JFK',
        schema: z.object({
            route: z.string().describe('Route in IATA format, e.g. FRA-JFK'),
            date:  z.string().describe('Date in YYYY-MM-DD format')
        })
    }
)