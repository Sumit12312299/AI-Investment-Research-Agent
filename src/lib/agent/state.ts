import { Annotation } from "@langchain/langgraph";
import { CompanyOverview, FinancialMetrics, NewsArticle, SWOTAnalysis, InvestmentDecision, AgentLog } from "./types";

export const AgentStateAnnotation = Annotation.Root({
  companyName: Annotation<string>(),
  openaiApiKey: Annotation<string | undefined>(),
  geminiApiKey: Annotation<string | undefined>(),
  tavilyApiKey: Annotation<string | undefined>(),
  logs: Annotation<AgentLog[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  overview: Annotation<CompanyOverview | undefined>(),
  financials: Annotation<FinancialMetrics | undefined>(),
  news: Annotation<NewsArticle[] | undefined>(),
  swot: Annotation<SWOTAnalysis | undefined>(),
  decision: Annotation<InvestmentDecision | undefined>(),
});
