import { registerTool } from './toolRegistry'
import { weatherData }  from '../data/weatherStore'
import { flights }      from '../data/flightStore'
import { regions }      from '../data/regionStore'

function getSeverity(condition: string): 'low' | 'moderate' | 'critical' {
    if (['Stormy', 'Snow'].includes(condition)) return 'critical'
    if (['Rain', 'Fog'].includes(condition))    return 'moderate'
    return 'low'
}

registerTool(
    {
        name: 'get_weather_impact',
        description: 'Returns all flights affected by critical or moderate weather conditions in a region. Use this when the user wants to know which flights are impacted by bad weather.',
        parameters: {
            type: 'object',
            properties: {
                region:   { type: 'string', description: 'Region ID e.g. EU, NA, ME, APAC' },
                date:     { type: 'string', description: 'Optional date in YYYY-MM-DD format' },
                severity: { type: 'string', description: 'Optional minimum severity: low, moderate, critical' }
            },
            required: ['region']
        }
    },
    async (args) => {
        const { region, date, severity } = args as {
            region:    string
            date?:     string
            severity?: string
        }

        const minSeverity = severity ?? 'moderate'
        const severityRank: Record<string, number> = { low: 0, moderate: 1, critical: 2 }

        const relevantWeather = weatherData.filter(w =>
            w.region.toUpperCase() === region.toUpperCase() &&
            (date ? w.date === date : true) &&
            severityRank[getSeverity(w.condition)] >= severityRank[minSeverity]
        )

        if (relevantWeather.length === 0) {
            return { message: `No critical weather found for region: ${region}` }
        }

        const regionData    = regions.find(r => r.region_id.toUpperCase() === region.toUpperCase())
        const regionAirports = regionData?.airports ?? []

        const affectedFlights = flights.filter(f => {
            const [origin, destination] = f.route.split('-')
            const inRegion = regionAirports.includes(origin) || regionAirports.includes(destination)
            return inRegion && (date ? f.date === date : true)
        })

        return {
            region,
            weather_conditions: relevantWeather.map(w => ({
                ...w,
                severity: getSeverity(w.condition)
            })),
            affected_flights:       affectedFlights.length,
            flights:                affectedFlights
        }
    }
)