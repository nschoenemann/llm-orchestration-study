import 'dotenv/config'
import { ChatOpenAI }             from '@langchain/openai'
import { ChatAnthropic }          from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseChatModel }     from '@langchain/core/language_models/chat_models'
import { retrieve }               from '../rag/ragChain'
import { buildGraph }             from './graph'
import { THRESHOLDS }             from '../config/thresholds'

export function getActiveModel(): BaseChatModel {
    const provider = process.env.LLM_PROVIDER ?? 'openai'
    switch (provider) {
        case 'openai':
            return new ChatOpenAI({
                model:  'gpt-4o',
                apiKey: process.env.OPENAI_API_KEY
            })
        case 'claude':
            return new ChatAnthropic({
                model:  'claude-opus-4-5',
                apiKey: process.env.ANTHROPIC_API_KEY
            })
        case 'gemini':
            return new ChatGoogleGenerativeAI({
                model:      'gemini-3.1-pro-preview',
                apiKey:     process.env.GEMINI_API_KEY,
                maxRetries: 1
            })
        default:
            throw new Error(`Unknown provider: ${provider}`)
    }
}

export async function runAgent(userMessage: string): Promise<string> {

    // ── 1. Provider & Graph vorbereiten ──────────────────────────────────────
    const model = getActiveModel()
    const graph = buildGraph(model)

    // ── 2. RAG: relevante Policy-Chunks laden & System-Prompt aufbauen ────────
    const ragChunks    = await retrieve(userMessage)
    const systemPrompt = `Du bist ein hilfreicher Flug-Assistent für Mitarbeiter.

Relevante Richtlinien:
${ragChunks.map(c => `- ${c}`).join('\n')}

Beantworte Fragen präzise basierend auf den verfügbaren Tools und Richtlinien.

Wichtig:
- Wenn kein Datum angegeben wurde, suche über ALLE verfügbaren Daten
- Frage nicht nach einem fehlenden Datum
- Das System überwacht intern Frühwarn-Schwellenwerte: Verspätung > ${THRESHOLDS.delay_warning} Min oder Crew-Dienstzeit > ${THRESHOLDS.crew_duty_warning}h
- Bei Überschreitung dieser Schwellenwerte wird automatisch eine Eskalationsprüfung eingeleitet
- Bei kritischem Wetter über ${THRESHOLDS.cancellation_weather_hours}h wird automatisch eine Cancellation-Prüfung eingeleitet`

    // ── 3. Graph ausführen ────────────────────────────────────────────────────
    const result = await graph.invoke({
        messages: [
            new SystemMessage(systemPrompt),
            new HumanMessage(userMessage)
        ]
    })

    // ── 4. Finale Antwort extrahieren ─────────────────────────────────────────
    const lastMessage = result.messages[result.messages.length - 1]
    return typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content)
}