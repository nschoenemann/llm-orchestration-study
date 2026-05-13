import { writeFileSync } from 'fs'
import { join }          from 'path'

// ── Regions ──────────────────────────────────────────────────────────────────
const regions = [
    { region_id: 'EU',   name: 'Europe',        airports: ['FRA', 'LHR', 'AMS', 'IST', 'CDG', 'MUC', 'FCO'] },
    { region_id: 'NA',   name: 'North America',  airports: ['JFK', 'LAX', 'ORD', 'YYZ', 'MIA'] },
    { region_id: 'ME',   name: 'Middle East',    airports: ['DXB', 'DOH', 'AUH', 'RUH'] },
    { region_id: 'APAC', name: 'Asia Pacific',   airports: ['SIN', 'HKG', 'NRT', 'SYD', 'BKK'] },
]

// ── Weather ───────────────────────────────────────────────────────────────────
const conditions = ['Clear', 'Rain', 'Snow', 'Stormy', 'Fog']

const weather = []
let weatherId = 1

for (const region of regions) {
    for (let day = 0; day < 4; day++) {
        const date      = new Date('2026-02-25')
        date.setDate(date.getDate() + day)
        const dateStr   = date.toISOString().split('T')[0]
        const condition = conditions[Math.floor(Math.random() * conditions.length)]
        const duration = ['Stormy', 'Snow'].includes(condition)
            ? Math.floor(Math.random() * 12) + 4
            : Math.floor(Math.random() * 4) + 1

        weather.push({
            weather_id:     `W${String(weatherId++).padStart(3, '0')}`,
            region:         region.region_id,
            date:           dateStr,
            condition,
            duration_hours: duration,
            start_time:     `${dateStr}T06:00`,
            end_time:       `${dateStr}T${String(6 + duration).padStart(2, '0')}:00`
        })
    }
}

// ── Flights ───────────────────────────────────────────────────────────────────
const airlines = ['LH', 'AF', 'BA', 'EK', 'QR', 'TK', 'KL', 'IB']
const dates     = ['2026-02-25', '2026-02-26', '2026-03-01', '2026-03-15']
const allAirports = regions.flatMap(r => r.airports)
const flights     = []

for (let i = 1; i <= 100; i++) {
    const airline     = airlines[Math.floor(Math.random() * airlines.length)]
    const id          = `${airline}${100 + i}`
    const origin      = allAirports[Math.floor(Math.random() * allAirports.length)]
    let   destination = allAirports[Math.floor(Math.random() * allAirports.length)]
    while (destination === origin) {
        destination = allAirports[Math.floor(Math.random() * allAirports.length)]
    }
    const delay  = Math.random() > 0.3 ? Math.floor(Math.random() * 150) : 0
    const departureHour = Math.floor(Math.random() * 20) + 4
    const flightHours   = Math.floor(Math.random() * 10) + 1
    const arrivalHour   = (departureHour + flightHours) % 24

    flights.push({
        flight_id:       id,
        airline,
        route:           `${origin}-${destination}`,
        date:            dates[Math.floor(Math.random() * dates.length)],
        departure_time:  `${String(Math.floor(Math.random() * 20) + 4).padStart(2, '0')}:00`,
        arrival_time:     `${String(arrivalHour).padStart(2, '0')}:00`,
        delay_minutes:   delay,
        crew_duty_hours: Math.random() > 0.1 ? +(Math.random() * 13).toFixed(1) : null,
        passengers:      Math.floor(Math.random() * 250) + 50
    })
}

// ── Write files ───────────────────────────────────────────────────────────────
const base = join(process.cwd(), 'src/data')

writeFileSync(join(base, 'flights.json'),  JSON.stringify(flights,  null, 2))
writeFileSync(join(base, 'weather.json'),  JSON.stringify(weather,  null, 2))
writeFileSync(join(base, 'regions.json'),  JSON.stringify(regions,  null, 2))

console.log(`Generated:`)
console.log(`  ${flights.length} flights`)
console.log(`  ${weather.length} weather records`)
console.log(`  ${regions.length} regions`)