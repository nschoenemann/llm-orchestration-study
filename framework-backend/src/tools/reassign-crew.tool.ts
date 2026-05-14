import { tool }    from '@langchain/core/tools'
import { z }       from 'zod'
import { flights } from '../data/flightStore'
import { logTool } from '../logger'

const CREW_DUTY_CRITICAL = 11.5

export const reassignCrewTool = tool(
    async ({ cancelled_flight_id, airline, date }) => {
        logTool(`reassign_crew – ${JSON.stringify({ cancelled_flight_id, airline, date })}`)

        const cancelledFlight = flights.find(f =>
            f.flight_id.toUpperCase() === cancelled_flight_id.toUpperCase()
        )

        if (!cancelledFlight) {
            return `No flight found with ID: ${cancelled_flight_id}`
        }

        const eligibleFlights = flights.filter(f =>
            f.airline   === airline &&
            f.date      === date &&
            f.flight_id !== cancelled_flight_id &&
            (f.crew_duty_hours === null || f.crew_duty_hours < CREW_DUTY_CRITICAL)
        )

        if (eligibleFlights.length === 0) {
            return JSON.stringify({
                reassignment_possible: false,
                message: `No eligible flights found for crew reassignment for airline ${airline} on ${date}`
            })
        }

        return JSON.stringify({
            reassignment_possible: true,
            cancelled_flight:      cancelled_flight_id,
            airline,
            date,
            eligible_flights:      eligibleFlights.length,
            recommended_flights:   eligibleFlights
                .sort((a, b) => (a.crew_duty_hours ?? 0) - (b.crew_duty_hours ?? 0))
                .slice(0, 3)
        })
    },
    {
        name: 'reassign_crew',
        description: 'Finds available flights for crew reassignment after a cancellation. Returns flights from the same airline on the same day that do not exceed duty hour limits.',
        schema: z.object({
            cancelled_flight_id: z.string().describe('ID of the cancelled flight'),
            airline:             z.string().describe('Airline code e.g. AF'),
            date:                z.string().describe('Date in YYYY-MM-DD format')
        })
    }
)