import { registerTool }          from './toolRegistry'
import { weatherData }           from '../data/weatherStore'

function getSeverity(condition: string): 'low' | 'moderate' | 'critical' {
    if (['Stormy', 'Snow'].includes(condition)) return 'critical'
    if (['Rain', 'Fog'].includes(condition))    return 'moderate'
    return 'low'
}

registerTool(
    {
        name: 'get_weather_by_region',
        description: 'Returns current weather conditions for a given region including severity and duration. Use this when the user asks about weather in a specific region or wants to assess weather impact on flights.',
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

        const results = weatherData
            .filter(w =>
                w.region.toUpperCase() === region.toUpperCase() &&
                (date ? w.date === date : true)
            )
            .map(w => ({
                ...w,
                severity: getSeverity(w.condition)
            }))

        if (results.length === 0) {
            return { message: `No weather data found for region: ${region}` }
        }

        const critical = results.filter(w => w.severity === 'critical')

        return {
            region,
            total_records:    results.length,
            critical_count:   critical.length,
            has_critical:     critical.length > 0,
            weather_records:  results
        }
    }
)