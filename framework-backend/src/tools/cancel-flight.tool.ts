import { tool }    from '@langchain/core/tools'
import { z }       from 'zod'
import { flights } from '../data/flightStore'
import { logTool } from '../logger'

export const cancelFlightTool = tool(
    async ({ flight_id, reason }) => {
        logTool(`cancel_flight – ${JSON.stringify({ flight_id, reason })}`)

        const flight = flights.find(f =>
            f.flight_id.toUpperCase() === flight_id.toUpperCase()
        )

        if (!flight) {
            return `No flight found with ID: ${flight_id}`
        }

        const alternatives = flights.filter(f =>
            f.airline   === flight.airline &&
            f.date      === flight.date &&
            f.flight_id !== flight.flight_id &&
            (f.delay_minutes === null || f.delay_minutes === 0)
        )

        return JSON.stringify({
            cancelled_flight:    flight_id,
            reason,
            airline:             flight.airline,
            date:                flight.date,
            route:               flight.route,
            alternatives_count:  alternatives.length,
            alternative_flights: alternatives.slice(0, 5)
        })
    },
    {
        name: 'cancel_flight',
        description: 'Cancels a specific flight and returns available alternative flights from the same airline on the same day. Use this after check_cancellation has confirmed cancellation is required.',
        schema: z.object({
            flight_id: z.string().describe('Flight ID to cancel e.g. AF103'),
            reason:    z.string().describe('Reason for cancellation e.g. critical_weather')
        })
    }
)