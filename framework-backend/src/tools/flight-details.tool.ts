import { tool }        from '@langchain/core/tools'
import { z }           from 'zod'
import { flights }     from '../data/flightStore'
import { logTool }     from '../logger'

export const getFlightDetailsTool = tool(
    async ({ flight_id }) => {
        logTool(`get_flight_details – ${JSON.stringify({ flight_id })}`)
        const flight = flights.find(f =>
            f.flight_id.toUpperCase() === flight_id.toUpperCase()
        )
        return flight
            ? JSON.stringify(flight)
            : `No flight found with ID: ${flight_id}`
    },
    {
        name: 'get_flight_details',
        description: 'Returns detailed information about a specific flight by its ID.',
        schema: z.object({
            flight_id: z.string().describe('The unique flight identifier, e.g. AF103')
        })
    }
)