// Gemini-spezifischer Retry-Mechanismus für 503 Service Unavailable
// Preview-Modelle haben eine höhere Instabilitätsrate als stabile Produktionsmodelle
const MAX_RETRIES = 3
const RETRY_DELAY = 2000 // ms

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await fn()
        } catch (err: any) {
            const is503 = err?.status === 503 ||
                err?.message?.includes('503') ||
                err?.message?.includes('Service Unavailable') ||
                err?.message?.toLowerCase().includes('overloaded')

            if (is503 && attempt < MAX_RETRIES) {
                console.warn(`Gemini 503 – Retry ${attempt}/${MAX_RETRIES - 1} in ${RETRY_DELAY * attempt}ms...`)
                await new Promise(res => setTimeout(res, RETRY_DELAY * attempt))
                continue
            }
            throw err
        }
    }
    throw new Error('Gemini: Max retries reached')
}
