import { readFileSync } from 'fs'
import { join }         from 'path'

export interface Region {
    region_id: string
    name:      string
    airports:  string[]
}

export const regions: Region[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/regions.json'), 'utf-8')
)