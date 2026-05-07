import { readFileSync } from 'fs'
import { join }         from 'path'
import type { Flight }  from '../types/domain'

export const flights: Flight[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/flights.json'), 'utf-8')
)