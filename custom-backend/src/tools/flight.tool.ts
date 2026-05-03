import { readFileSync } from 'fs'
import { join }         from 'path'
import { registerTool } from './toolRegistry'
import {Flight} from "../types/domain";

const flights: Flight[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/flights.json'), 'utf-8')
)

registerTool(
    {
        name: 'get_flights',
        description: 'Returns available flights for a given route and date. Route format is ORIGIN-DESTINATION in IATA codes, e.g. FRA-JFK',
        parameters: {
            type: 'object',
            properties: {
                route: { type: 'string', description: 'Route in IATA format, e.g. FRA-JFK' },
                date:  { type: 'string', description: 'Date in YYYY-MM-DD format' }
            },
            required: ['route', 'date']
        }
    },
    async (args) => {
        const { route, date } = args as { route: string; date: string }
        const results = flights.filter(f =>
            f.route?.toUpperCase() === route.toUpperCase() &&
            f.date === date
        )
        return results.length > 0 ? results : { message: 'No flights found' }
    }
)