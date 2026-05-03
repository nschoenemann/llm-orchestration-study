import { registerTool } from './toolRegistry'
import {flights} from "../data/flightStore";

registerTool(
    {
        name: 'get_routes_by_destination',
        description: 'Returns all available routes arriving at a given destination airport',
        parameters: {
            type: 'object',
            properties: {
                destination: { type: 'string', description: 'Arrival airport in IATA format, e.g. JFK' }
            },
            required: ['destination']
        }
    },
    async (args) => {
        const { destination } = args as { destination: string }
        const routes = [...new Set(
            flights
                .filter(f => f.route?.toUpperCase().endsWith(destination.toUpperCase()))
                .map(f => f.route)
        )]
        return routes.length > 0 ? routes : { message: 'No routes found for this destination' }
    }
)