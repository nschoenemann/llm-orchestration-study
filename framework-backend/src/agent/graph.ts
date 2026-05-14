import { StateGraph, END }            from '@langchain/langgraph'
import { AgentStateAnnotation }       from './state'
import type { AgentState }            from './state'
import {
    callLLMNode,
    executeToolsNode,
    handleEscalationNode,
    handleCancellationNode,
    routeAfterTools,
    routeAfterLLM,
    ROUTES
}                                     from './nodes'
import { getFlightsTool }             from '../tools/flight.tool'
import { getRoutesByOriginTool }      from '../tools/routes-by-origin.tool'
import { getRoutesByDestinationTool } from '../tools/routes-by-destination.tool'
import { getFlightDetailsTool }       from '../tools/flight-details.tool'
import { escalateFlightTool }         from '../tools/escalate-flight.tool'
import { getFlightsByAirlineTool }    from '../tools/flights-by-airline.tool'
import { getFlightsByRegionTool }     from '../tools/flights-by-region.tool'
import { getDelayAnalysisTool }       from '../tools/delay-analysis.tool'
import { getCrewDutyAnalysisTool }    from '../tools/crew-duty-analysis.tool'
import { getAirlineStatsTool }        from '../tools/airline-stats.tool'
import { getWeatherByRegionTool }     from '../tools/weather-by-region.tool'
import { getWeatherImpactTool }       from '../tools/weather-impact.tool'
import { checkCancellationTool }      from '../tools/check-cancellation.tool'
import { cancelFlightTool }           from '../tools/cancel-flight.tool'
import { reassignCrewTool }           from '../tools/reassign-crew.tool'

export const tools = [
    getFlightsTool,
    getRoutesByOriginTool,
    getRoutesByDestinationTool,
    getFlightDetailsTool,
    escalateFlightTool,
    getFlightsByAirlineTool,
    getFlightsByRegionTool,
    getDelayAnalysisTool,
    getCrewDutyAnalysisTool,
    getAirlineStatsTool,
    getWeatherByRegionTool,
    getWeatherImpactTool,
    checkCancellationTool,
    cancelFlightTool,
    reassignCrewTool
]

export function buildGraph(model: any) {
    const modelWithTools = model.bindTools(tools)

    const workflow = new StateGraph(AgentStateAnnotation)

    workflow
        .addNode('call_llm',            (state: AgentState) => callLLMNode(state, modelWithTools))
        .addNode('execute_tools',       (state: AgentState) => executeToolsNode(state, tools))
        .addNode('handle_escalation',   (state: AgentState) => handleEscalationNode(state))
        .addNode('handle_cancellation', (state: AgentState) => handleCancellationNode(state, tools))
        .addEdge('__start__',           'call_llm')
        .addConditionalEdges('call_llm', routeAfterLLM, {
            [ROUTES.TOOLS]: 'execute_tools',
            [ROUTES.END]:   END
        })
        .addConditionalEdges('execute_tools', routeAfterTools, {
            [ROUTES.ESCALATE]: 'handle_escalation',
            [ROUTES.CANCEL]:   'handle_cancellation',
            [ROUTES.CONTINUE]: 'call_llm'
        })
        .addEdge('handle_escalation',   'call_llm')
        .addEdge('handle_cancellation', 'call_llm')

    return workflow.compile()
}