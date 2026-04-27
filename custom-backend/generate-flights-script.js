// src/scripts/generate-flights.ts
import { writeFileSync } from 'fs'
import { join }          from 'path'

const airlines = ['LH', 'AF', 'BA', 'EK', 'QR', 'TK', 'KL', 'IB']
const regions  = ['EU', 'ME', 'APAC', 'NA']
const routes   = ['FRA-JFK', 'LHR-DXB', 'DXB-SIN', 'DOH-FRA', 'IST-AMS', 'AMS-JFK']
const weather  = ['Clear', 'Rain', 'Stormy', 'Fog', 'Snow', null]
const dates    = ['2026-02-25', '2026-03-01', '2026-03-15', '2026-04-01']

const flights = []

for (let i = 1; i <= 100; i++) {
    const airline = airlines[Math.floor(Math.random() * airlines.length)]
    const id      = `${airline}${100 + i}`

    flights.push({
        flight_id:       id,
        airline,
        region:          regions[Math.floor(Math.random() * regions.length)],
        date:            dates[Math.floor(Math.random() * dates.length)],
        route:           routes[Math.floor(Math.random() * routes.length)],
        delay_minutes:   Math.random() > 0.1 ? Math.floor(Math.random() * 150) : null,
        crew_duty_hours: Math.random() > 0.1 ? +(Math.random() * 13).toFixed(1) : null,
        weather:         weather[Math.floor(Math.random() * weather.length)]
    })
}

writeFileSync(
    join(process.cwd(), 'src/data/flights.json'),
    JSON.stringify(flights, null, 2)
)
console.log(`Generated ${flights.length} flights`)