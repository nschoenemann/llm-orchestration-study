import { readFileSync } from 'fs'
import { join }         from 'path'

export interface Weather {
    weather_id:     string
    region:         string
    date:           string
    condition:      string
    duration_hours: number
    start_time:     string
    end_time:       string
}

export const weatherData: Weather[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/weather.json'), 'utf-8')
)