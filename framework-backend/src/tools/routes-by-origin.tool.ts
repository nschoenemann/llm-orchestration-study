import { tool }        from '@langchain/core/tools'
import { z }           from 'zod'
import { flights }     from '../data/flightStore'

export const getRoutesByOriginTool = tool(
    async ({ origin }) => {
        const routes = [...new Set(
            flights
                .filter(f => f.route?.toUpperCase().startsWith(origin.toUpperCase()))
                .map(f => f.route)
        )]
        return routes.length > 0
            ? JSON.stringify(routes)
            : 'No routes found for this origin'
    },
    {
        name: 'get_routes_by_origin',
        description: 'Returns all available routes departing from a given origin airport. Use this when the user mentions a departure airport without specifying the full route or destination.',
        schema: z.object({
            origin: z.string().describe('Departure airport in IATA format, e.g. FRA')
        })
    }
)