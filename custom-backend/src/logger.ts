import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

interface LogEntry {
    role: 'user' | 'assistant' | 'tool'
    content: string
    timestamp: string
}

interface Session {
    provider: string
    scenario: string
    startTime: string
    entries: LogEntry[]
}

const session: Session = {
    provider:  process.env.LLM_PROVIDER ?? 'openai',
    scenario:  '',
    startTime: new Date().toISOString(),
    entries:   []
}

export function setScenario(name: string) {
    session.scenario = name
}

export function logUser(content: string) {
    session.entries.push({
        role:      'user',
        content,
        timestamp: new Date().toISOString()
    })
}

export function logAssistant(content: string) {
    session.entries.push({
        role:      'assistant',
        content,
        timestamp: new Date().toISOString()
    })
}

export function logTool(content: string) {
    session.entries.push({
        role:      'tool',
        content,
        timestamp: new Date().toISOString()
    })
}

export function saveSession() {
    const logsDir = join(process.cwd(), 'logs', session.provider)
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const scenario  = session.scenario || 'unknown'
    const filename  = `${timestamp}_${scenario}.md`
    const filepath  = join(logsDir, filename)

    const lines: string[] = [
        `# Session Log`,
        `**Provider:** ${session.provider}`,
        `**Scenario:** ${scenario}`,
        `**Start:** ${session.startTime}`,
        `**End:** ${new Date().toISOString()}`,
        `---`,
        ``
    ]

    for (const entry of session.entries) {
        if (entry.role === 'user') {
            lines.push(`**You:** ${entry.content}`)
            lines.push(`*${entry.timestamp}*`)
            lines.push(``)
        } else if (entry.role === 'assistant') {
            lines.push(`**Assistant:** ${entry.content}`)
            lines.push(`*${entry.timestamp}*`)
            lines.push(``)
        } else if (entry.role === 'tool') {
            lines.push(`> 🔧 Tool: ${entry.content}`)
            lines.push(``)
        }
    }

    writeFileSync(filepath, lines.join('\n'))
    console.log(`\nSession saved to: logs/${session.provider}/${filename}`)
}