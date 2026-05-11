import { BaseCallbackHandler }  from '@langchain/core/callbacks/base'
import { Serialized }           from '@langchain/core/load/serializable'
import { logTool }              from '../logger'

export class LoggingCallbackHandler extends BaseCallbackHandler {
    name = 'LoggingCallbackHandler'

    async handleToolStart(
        tool:        Serialized,
        input:       string,
        runId:       string,
        parentRunId?: string,
        tags?:        string[],
        metadata?:    Record<string, unknown>,
        runName?:     string,
        toolCallId?:  string
    ): Promise<void> {
        const name = runName ?? tool.id?.[tool.id.length - 1] ?? 'unknown'
        logTool(`${name} – ${input}`)
    }
}