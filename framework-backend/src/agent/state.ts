import { Annotation }   from '@langchain/langgraph'
import { BaseMessage }  from '@langchain/core/messages'

export const AgentStateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => []
    }),
    escalation_triggered: Annotation<boolean>({
        reducer: (_, y) => y,
        default: () => false
    }),
    escalation_reason: Annotation<string | null>({
        reducer: (_, y) => y,
        default: () => null
    }),
    escalation_route: Annotation<string | null>({   // NEU: Route für Metadaten-Filter
        reducer: (_, y) => y,
        default: () => null
    }),
    cancellation_needed: Annotation<boolean>({
        reducer: (_, y) => y,
        default: () => false
    })
})

export type AgentState = typeof AgentStateAnnotation.State