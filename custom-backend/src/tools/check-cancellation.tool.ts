import { registerTool } from './toolRegistry'
import { weatherData }  from '../data/weatherStore'
import { flights }      from '../data/flightStore'
import { regions }      from '../data/regionStore'

function getSeverity(condition: string): 'low' | 'moderate' | 'critical' {
    if (['Stormy', 'Snow'].includes(condition)) return 'critical'
    if (['Rain', 'Fog'].includes(condition))    return 'moderate'
    return 'low'
}

const CANCELLATION_THRESHOLD_HOURS = 6  // Policy: ab 6h kritisches Wetter

registerTool(
    {
        name: 'check_cancellation',
        description: 'Checks whether flights in a region should be cancelled based on weather duration policy. Returns flights that meet cancellation criteria. Use this when critical weather has been detected and cancellation needs to be evaluated.',
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

        const criticalWeather = weatherData.filter(w =>
            w.region.toUpperCase() === region.toUpperCase() &&
            (date ? w.date === date : true) &&
            getSeverity(w.condition) === 'critical' &&
            w.duration_hours >= CANCELLATION_THRESHOLD_HOURS
        )

        if (criticalWeather.length === 0) {
            return {
                cancellation_required: false,
                message: `No critical weather exceeding ${CANCELLATION_THRESHOLD_HOURS}h threshold found for region: ${region}`
            }
        }

        const regionData     = regions.find(r => r.region_id.toUpperCase() === region.toUpperCase())
        const regionAirports = regionData?.airports ?? []

        const affectedFlights = flights.filter(f => {
            const [origin, destination] = f.route.split('-')
            const inRegion = regionAirports.includes(origin) || regionAirports.includes(destination)
            return inRegion && (date ? f.date === date : true)
        })

        return {
            cancellation_required:   true,
            reason:                  'critical_weather_duration',
            threshold_hours:         CANCELLATION_THRESHOLD_HOURS,
            critical_weather:        criticalWeather.map(w => ({
                ...w,
                severity: getSeverity(w.condition)
            })),
            affected_flights_count:  affectedFlights.length,
            flights_to_cancel:       affectedFlights
        }
    }
)