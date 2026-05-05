import { registerTool } from './toolRegistry'
import {flights} from "../data/flightStore";

registerTool(
    {
        name: 'get_flights',
        description: 'Returns available flights for a given route. Optionally filter by date. If no date is provided, returns all flights for that route across all dates in the database.',
        parameters: {
            type: 'object',
            properties: {
                route: { type: 'string', description: 'Route in IATA format, e.g. FRA-JFK' },
                date:  { type: 'string', description: 'Optional date in YYYY-MM-DD format. Omit to search across all dates.' }
            },
            required: ['route']
        }
    },
    async (args) => {
        const { route, date } = args as { route: string; date?: string }
        const results = flights.filter(f =>
            f.route?.toUpperCase() === route.toUpperCase() &&
            (date ? f.date === date : true)
        )
        return results.length > 0 ? results : { message: 'No flights found' }
    }
)