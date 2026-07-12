export interface CompanyOverview {
  name: string;
  ticker?: string;
  sector: string;
  industry: string;
  businessDescription: string;
  keyProducts: string[];
  competitors: string[];
}

export interface FinancialMetrics {
  peRatio?: number;
  psRatio?: number;
  pbRatio?: number;
  evToRevenue?: number;
  evToEbitda?: number;
  revenueGrowthYoY?: number;
  earningsGrowthYoY?: number;
  grossMargin?: number;
  operatingMargin?: number;
  netMargin?: number;
  debtToEquity?: number;
  currentRatio?: number;
  freeCashFlow?: string;
  dividendYield?: number;
  marketCap?: string;
  currency?: string;
}

export interface NewsArticle {
  title: string;
  source: string;
  date: string;
  snippet: string;
  url?: string;
  sentiment?: "positive" | "negative" | "neutral";
}

export interface SWOTAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface InvestmentDecision {
  recommendation: "BUY" | "HOLD" | "PASS";
  score: number; // 0 - 100
  targetPrice?: string;
  investmentThesis: string;
  risksAndMitigations: { risk: string; mitigation: string }[];
  keyMetricsAnalyzed: { metric: string; value: string; assessment: string }[];
  summaryMemo: string;
}

export interface AgentLog {
  timestamp: string;
  node: string;
  message: string;
  status: "pending" | "success" | "info" | "error";
}

export interface AgentState {
  companyName: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  tavilyApiKey?: string;
  logs: AgentLog[];
  overview?: CompanyOverview;
  financials?: FinancialMetrics;
  news?: NewsArticle[];
  swot?: SWOTAnalysis;
  decision?: InvestmentDecision;
}
