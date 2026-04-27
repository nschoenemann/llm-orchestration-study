import type { ToolDefinition } from '../providers/types'

interface RegisteredTool {
    definition: ToolDefinition
    execute: (args: Record<string, unknown>) => Promise<unknown>
}

const registry = new Map<string, RegisteredTool>()

export function registerTool(
    definition: ToolDefinition,
    execute: (args: Record<string, unknown>) => Promise<unknown>
) {
    registry.set(definition.name, { definition, execute })
}

export function getToolDefinitions(): ToolDefinition[] {
    return [...registry.values()].map(t => t.definition)
}

export async function executeTool(
    name: string,
    args: Record<string, unknown>
): Promise<unknown> {
    const tool = registry.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)
    return tool.execute(args)
}