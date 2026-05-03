import { readFileSync } from 'fs'
import { join }         from 'path'
import { registerTool } from './toolRegistry'
import {Flight} from "../types/domain";

const flights: Flight[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/flights.json'), 'utf-8')
)

registerTool(
    {
        name: 'get_routes_by_origin',
        description: 'Returns all available routes departing from a given origin airport',
        parameters: {
            type: 'object',
            properties: {
                origin: { type: 'string', description: 'Departure airport in IATA format, e.g. FRA' }
            },
            required: ['origin']
        }
    },
    async (args) => {
        const { origin } = args as { origin: string }
        const routes = [...new Set(
            flights
                .filter(f => f.route?.toUpperCase().startsWith(origin.toUpperCase()))
                .map(f => f.route)
        )]
        return routes.length > 0 ? routes : { message: 'No routes found for this origin' }
    }
)