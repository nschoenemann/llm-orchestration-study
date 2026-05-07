import { tool }         from '@langchain/core/tools'
import { z }            from 'zod'
import { readFileSync } from 'fs'
import { join }         from 'path'
import { logTool }      from '../logger'
import type { Flight }  from '../types/domain'

const flights: Flight[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/flights.json'), 'utf-8')
)

export const getFlightsTool = tool(
    async ({ route, date }) => {
        logTool(`get_flights – ${JSON.stringify({ route, date })}`)
        const results = flights.filter(f =>
            f.route?.toUpperCase() === route.toUpperCase() &&
            (date ? f.date === date : true)
        )
        return results.length > 0
            ? JSON.stringify(results)
            : 'No flights found'
    },
    {
        name: 'get_flights',
        description: 'Returns available flights for a given route. Optionally filter by date. If no date is provided, returns all flights for that route across all dates in the database.',
        schema: z.object({
            route: z.string().describe('Route in IATA format, e.g. FRA-JFK'),
            date:  z.string().optional().describe('Optional date in YYYY-MM-DD format. Omit to search across all dates.')
        })
    }
)