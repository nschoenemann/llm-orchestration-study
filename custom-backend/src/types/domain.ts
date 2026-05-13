export interface Flight {
    flight_id:       string
    airline:         string
    route:           string
    date:            string
    departure_time:  string
    arrival_time:    string
    delay_minutes:   number | null
    crew_duty_hours: number | null
    passengers:      number | null
}