import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentStateAnnotation } from "./state";
import { 
  gatherOverviewNode, 
  gatherNewsAndFinancialsNode, 
  analyzeSWOTNode, 
  makeDecisionNode 
} from "./nodes";

// Build the LangGraph workflow
const workflow = new StateGraph(AgentStateAnnotation)
  .addNode("gatherOverview", gatherOverviewNode)
  .addNode("gatherNewsAndFinancials", gatherNewsAndFinancialsNode)
  .addNode("analyzeSWOT", analyzeSWOTNode)
  .addNode("makeDecision", makeDecisionNode)
  
  // Define edges
  .addEdge(START, "gatherOverview")
  .addEdge("gatherOverview", "gatherNewsAndFinancials")
  .addEdge("gatherNewsAndFinancials", "analyzeSWOT")
  .addEdge("analyzeSWOT", "makeDecision")
  .addEdge("makeDecision", END);

// Compile the workflow graph
export const investmentGraph = workflow.compile();
export type InvestmentGraphType = typeof investmentGraph;
