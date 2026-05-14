import { tool }        from '@langchain/core/tools'
import { z }           from 'zod'
import { flights }     from '../data/flightStore'
import { regions }     from '../data/regionStore'
import { logTool }     from '../logger'

function getStatus(delay_minutes: number | null): 'on_time' | 'delayed' {
    if (!delay_minutes || delay_minutes === 0) return 'on_time'
    return 'delayed'
}

export const getFlightsByRegionTool = tool(
    async ({ region, date }) => {
        logTool(`get_flights_by_region – ${JSON.stringify({ region, date })}`)

        const regionData = regions.find(r =>
            r.region_id.toUpperCase() === region.toUpperCase()
        )

        if (!regionData) {
            return `Unknown region: ${region}. Available: EU, NA, ME, APAC`
        }

        const results = flights
            .filter(f => {
                const [origin, destination] = f.route.split('-')
                const inRegion = regionData.airports.includes(origin) ||
                    regionData.airports.includes(destination)
                return inRegion && (date ? f.date === date : true)
            })
            .map(f => ({ ...f, status: getStatus(f.delay_minutes) }))

        return results.length > 0
            ? JSON.stringify(results)
            : `No flights found for region: ${region}`
    },
    {
        name: 'get_flights_by_region',
        description: 'Returns all flights where origin or destination airport belongs to a given region. Use this when the user asks about flights in a specific region.',
        schema: z.object({
            region: z.string().describe('Region ID e.g. EU, NA, ME, APAC'),
            date:   z.string().optional().describe('Optional date in YYYY-MM-DD format')
        })
    }
)