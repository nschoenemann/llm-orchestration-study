export interface Flight {
    flight_id:       string
    airline:         string
    region:          string
    date:            string
    route:           string
    delay_minutes:   number | null
    crew_duty_hours: number | null
    weather:         string | null
}