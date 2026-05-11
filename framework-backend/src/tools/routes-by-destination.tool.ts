import { tool }        from '@langchain/core/tools'
import { z }           from 'zod'
import { flights }     from '../data/flightStore'

export const getRoutesByDestinationTool = tool(
    async ({ destination }) => {
        const routes = [...new Set(
            flights
                .filter(f => f.route?.toUpperCase().endsWith(destination.toUpperCase()))
                .map(f => f.route)
        )]
        return routes.length > 0
            ? JSON.stringify(routes)
            : 'No routes found for this destination'
    },
    {
        name: 'get_routes_by_destination',
        description: 'Returns all available routes arriving at a given destination airport. Use this when the user mentions a destination airport without specifying the full route or origin.',
        schema: z.object({
            destination: z.string().describe('Arrival airport in IATA format, e.g. JFK')
        })
    }
)