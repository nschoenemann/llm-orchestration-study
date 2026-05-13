import { registerTool } from './toolRegistry'
import { flights }      from '../data/flightStore'

registerTool(
    {
        name: 'cancel_flight',
        description: 'Cancels a specific flight and returns available alternative flights from the same airline on the same day. Use this after check_cancellation has confirmed cancellation is required.',
        parameters: {
            type: 'object',
            properties: {
                flight_id: { type: 'string', description: 'Flight ID to cancel e.g. AF103' },
                reason:    { type: 'string', description: 'Reason for cancellation e.g. critical_weather' }
            },
            required: ['flight_id', 'reason']
        }
    },
    async (args) => {
        const { flight_id, reason } = args as { flight_id: string; reason: string }

        const flight = flights.find(f =>
            f.flight_id.toUpperCase() === flight_id.toUpperCase()
        )

        if (!flight) {
            return { message: `No flight found with ID: ${flight_id}` }
        }

        const alternatives = flights.filter(f =>
            f.airline    === flight.airline &&
            f.date       === flight.date &&
            f.flight_id  !== flight.flight_id &&
            (f.delay_minutes === null || f.delay_minutes === 0)
        )

        return {
            cancelled_flight:    flight_id,
            reason,
            airline:             flight.airline,
            date:                flight.date,
            route:               flight.route,
            alternatives_count:  alternatives.length,
            alternative_flights: alternatives.slice(0, 5)
        }
    }
)