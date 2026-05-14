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

const CANCELLATION_THRESHOLD_HOURS = 6

export const checkCancellationTool = tool(
    async ({ region, date }) => {
        logTool(`check_cancellation – ${JSON.stringify({ region, date })}`)

        const criticalWeather = weatherData.filter(w =>
            w.region.toUpperCase() === region.toUpperCase() &&
            (date ? w.date === date : true) &&
            getSeverity(w.condition) === 'critical' &&
            w.duration_hours >= CANCELLATION_THRESHOLD_HOURS
        )

        if (criticalWeather.length === 0) {
            return JSON.stringify({
                cancellation_required: false,
                message: `No critical weather exceeding ${CANCELLATION_THRESHOLD_HOURS}h threshold found for region: ${region}`
            })
        }

        const regionData     = regions.find(r => r.region_id.toUpperCase() === region.toUpperCase())
        const regionAirports = regionData?.airports ?? []

        const affectedFlights = flights.filter(f => {
            const [origin, destination] = f.route.split('-')
            const inRegion = regionAirports.includes(origin) || regionAirports.includes(destination)
            return inRegion && (date ? f.date === date : true)
        })

        return JSON.stringify({
            cancellation_required:  true,
            reason:                 'critical_weather_duration',
            threshold_hours:        CANCELLATION_THRESHOLD_HOURS,
            critical_weather:       criticalWeather.map(w => ({
                ...w,
                severity: getSeverity(w.condition)
            })),
            affected_flights_count: affectedFlights.length,
            flights_to_cancel:      affectedFlights
        })
    },
    {
        name: 'check_cancellation',
        description: 'Checks whether flights in a region should be cancelled based on weather duration policy. Call this directly when asked about flight cancellations due to weather – no need to check weather separately first.',
        schema: z.object({
            region: z.string().describe('Region ID e.g. EU, NA, ME, APAC'),
            date:   z.string().optional().describe('Optional date in YYYY-MM-DD format')
        })
    }
)