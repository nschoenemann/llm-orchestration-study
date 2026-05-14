import { tool }        from '@langchain/core/tools'
import { z }           from 'zod'
import { weatherData } from '../data/weatherStore'
import { logTool }     from '../logger'

function getSeverity(condition: string): 'low' | 'moderate' | 'critical' {
    if (['Stormy', 'Snow'].includes(condition)) return 'critical'
    if (['Rain', 'Fog'].includes(condition))    return 'moderate'
    return 'low'
}

export const getWeatherByRegionTool = tool(
    async ({ region, date }) => {
        logTool(`get_weather_by_region – ${JSON.stringify({ region, date })}`)

        const results = weatherData
            .filter(w =>
                w.region.toUpperCase() === region.toUpperCase() &&
                (date ? w.date === date : true)
            )
            .map(w => ({ ...w, severity: getSeverity(w.condition) }))

        if (results.length === 0) {
            return `No weather data found for region: ${region}`
        }

        const critical = results.filter(w => w.severity === 'critical')

        return JSON.stringify({
            region,
            total_records:   results.length,
            critical_count:  critical.length,
            has_critical:    critical.length > 0,
            weather_records: results
        })
    },
    {
        name: 'get_weather_by_region',
        description: 'Returns current weather conditions for a given region including severity and duration.',
        schema: z.object({
            region: z.string().describe('Region ID e.g. EU, NA, ME, APAC'),
            date:   z.string().optional().describe('Optional date in YYYY-MM-DD format')
        })
    }
)