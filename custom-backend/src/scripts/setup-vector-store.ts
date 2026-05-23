// scripts/setup-vector-store.ts
// Einmalig ausführen um Policy-Dateien bei OpenAI hochzuladen
// und einen persistenten Vector Store zu erstellen.
//
// Verwendung:
//   npx tsx src/scripts/setup-vector-store.ts
//
// Gibt am Ende die VECTOR_STORE_ID aus — diese in .env eintragen

import 'dotenv/config'
import OpenAI         from 'openai'
import { readFileSync, readdirSync } from 'fs'
import { join }       from 'path'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function main() {
    console.log('Creating Vector Store...')

    // Vector Store erstellen
    const vectorStore = await client.vectorStores.create({
        name: 'airline-policies',
    })
    console.log(`Vector Store created: ${vectorStore.id}`)

    // Alle Policy-Dateien hochladen
    const policyDir = join(process.cwd(), 'src/data/policy')
    const files     = readdirSync(policyDir)

    console.log(`Uploading ${files.length} policy files...`)

    const fileIds: string[] = []
    for (const file of files) {
        const content = readFileSync(join(policyDir, file))
        const uploaded = await client.files.create({
            file:    new File([content], file, { type: 'text/plain' }),
            purpose: 'assistants',
        })
        fileIds.push(uploaded.id)
        console.log(`  ✓ ${file} → ${uploaded.id}`)
    }

    // Dateien dem Vector Store hinzufügen
    await client.vectorStores.fileBatches.createAndPoll(vectorStore.id, {
        file_ids: fileIds,
    })

    console.log(`\nDone! Add this to your .env:\nVECTOR_STORE_ID=${vectorStore.id}`)
}

main().catch(console.error)