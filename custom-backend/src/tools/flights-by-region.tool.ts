import { registerTool } from './toolRegistry'
import { flights }      from '../data/flightStore'
import { regions } from '../data/regionStore'

interface Region {
    region_id: string
    name:      string
    airports:  string[]
}

function getStatus(delay_minutes: number | null): 'on_time' | 'delayed' {
    if (!delay_minutes || delay_minutes === 0) return 'on_time'
    return 'delayed'
}

registerTool(
    {
        name: 'get_flights_by_region',
        description: 'Returns all flights where origin or destination airport belongs to a given region. Use this when the user asks about flights in a specific region.',
        parameters: {
            type: 'object',
            properties: {
                region: { type: 'string', description: 'Region ID e.g. EU, NA, ME, APAC' },
                date:   { type: 'string', description: 'Optional date in YYYY-MM-DD format' }
            },
            required: ['region']
        }
    },
    async (args) => {
        const { region, date } = args as { region: string; date?: string }

        const regionData = regions.find(r =>
            r.region_id.toUpperCase() === region.toUpperCase()
        )

        if (!regionData) {
            return { message: `Unknown region: ${region}. Available: EU, NA, ME, APAC` }
        }

        const results = flights
            .filter(f => {
                const [origin, destination] = f.route.split('-')
                const inRegion = regionData.airports.includes(origin) ||
                    regionData.airports.includes(destination)
                return inRegion && (date ? f.date === date : true)
            })
            .map(f => ({
                ...f,
                status: getStatus(f.delay_minutes)
            }))

        return results.length > 0
            ? results
            : { message: `No flights found for region: ${region}` }
    }
)