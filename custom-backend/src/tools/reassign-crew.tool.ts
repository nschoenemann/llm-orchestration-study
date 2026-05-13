import { registerTool } from './toolRegistry'
import { flights }      from '../data/flightStore'

const CREW_DUTY_CRITICAL = 11.5

registerTool(
    {
        name: 'reassign_crew',
        description: 'Finds available flights for crew reassignment after a cancellation. Returns flights from the same airline on the same day that have crew capacity and do not exceed duty hour limits. Use this after cancel_flight to manage crew redistribution.',
        parameters: {
            type: 'object',
            properties: {
                cancelled_flight_id: { type: 'string', description: 'ID of the cancelled flight' },
                airline:             { type: 'string', description: 'Airline code e.g. AF' },
                date:                { type: 'string', description: 'Date in YYYY-MM-DD format' }
            },
            required: ['cancelled_flight_id', 'airline', 'date']
        }
    },
    async (args) => {
        const { cancelled_flight_id, airline, date } = args as {
            cancelled_flight_id: string
            airline:             string
            date:                string
        }

        const cancelledFlight = flights.find(f =>
            f.flight_id.toUpperCase() === cancelled_flight_id.toUpperCase()
        )

        if (!cancelledFlight) {
            return { message: `No flight found with ID: ${cancelled_flight_id}` }
        }

        // Flüge derselben Airline am selben Tag ohne Crew-Verstöße
        const eligibleFlights = flights.filter(f =>
            f.airline    === airline &&
            f.date       === date &&
            f.flight_id  !== cancelled_flight_id &&
            (f.crew_duty_hours === null || f.crew_duty_hours < CREW_DUTY_CRITICAL)
        )

        if (eligibleFlights.length === 0) {
            return {
                reassignment_possible: false,
                message: `No eligible flights found for crew reassignment for airline ${airline} on ${date}`
            }
        }

        return {
            reassignment_possible: true,
            cancelled_flight:      cancelled_flight_id,
            airline,
            date,
            eligible_flights:      eligibleFlights.length,
            recommended_flights:   eligibleFlights
                .sort((a, b) => (a.crew_duty_hours ?? 0) - (b.crew_duty_hours ?? 0))
                .slice(0, 3)
        }
    }
)