import { tool }        from '@langchain/core/tools'
import { z }           from 'zod'
import { weatherData } from '../data/weatherStore'
import { flights }     from '../data/flightStore'
import { regions }     from '../data/regionStore'
import { logTool }     from '../logger'

function getSeverity(condition: string): 'low' | 'moderate' | 'critical' {
    if (['Stormy', 'Snow'].includes(condition)) return 'critical'
    if (['Rain', 'Fog'].includes(condition))    return 'moderate'
    return 'low'
}

export const getWeatherImpactTool = tool(
    async ({ region, date, severity }) => {
        logTool(`get_weather_impact – ${JSON.stringify({ region, date, severity })}`)

        const minSeverity  = severity ?? 'moderate'
        const severityRank: Record<string, number> = { low: 0, moderate: 1, critical: 2 }

        const relevantWeather = weatherData.filter(w =>
            w.region.toUpperCase() === region.toUpperCase() &&
            (date ? w.date === date : true) &&
            severityRank[getSeverity(w.condition)] >= severityRank[minSeverity]
        )

        if (relevantWeather.length === 0) {
            return `No critical weather found for region: ${region}`
        }

        const regionData     = regions.find(r => r.region_id.toUpperCase() === region.toUpperCase())
        const regionAirports = regionData?.airports ?? []

        const affectedFlights = flights.filter(f => {
            const [origin, destination] = f.route.split('-')
            const inRegion = regionAirports.includes(origin) || regionAirports.includes(destination)
            return inRegion && (date ? f.date === date : true)
        })

        return JSON.stringify({
            region,
            weather_conditions: relevantWeather.map(w => ({
                ...w,
                severity: getSeverity(w.condition)
            })),
            affected_flights: affectedFlights.length,
            flights:          affectedFlights
        })
    },
    {
        name: 'get_weather_impact',
        description: 'Returns all flights affected by critical or moderate weather conditions in a region.',
        schema: z.object({
            region:   z.string().describe('Region ID e.g. EU, NA, ME, APAC'),
            date:     z.string().optional().describe('Optional date in YYYY-MM-DD format'),
            severity: z.string().optional().describe('Optional minimum severity: low, moderate, critical')
        })
    }
)