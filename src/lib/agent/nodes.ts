import { AgentState, CompanyOverview, FinancialMetrics, NewsArticle, SWOTAnalysis, InvestmentDecision, AgentLog } from "./types";
import { getModel } from "./model";
import { searchWeb } from "./search";

// Helper to append logs
function addLog(logs: AgentLog[], node: string, message: string, status: "pending" | "success" | "info" | "error"): AgentLog[] {
  return [
    ...logs,
    {
      timestamp: new Date().toLocaleTimeString(),
      node,
      message,
      status,
    },
  ];
}

// Helper to extract JSON from model response
function parseJsonFromText(text: string): any {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    // Check if it's an array
    const arrStart = text.indexOf("[");
    const arrEnd = text.lastIndexOf("]");
    if (arrStart !== -1 && arrEnd !== -1) {
      return JSON.parse(text.slice(arrStart, arrEnd + 1));
    }
    throw new Error("No JSON object or array found in LLM response:\n" + text);
  }
  const jsonStr = text.slice(start, end + 1);
  return JSON.parse(jsonStr);
}

/**
 * Node 1: Gather Company Overview
 */
export async function gatherOverviewNode(state: AgentState): Promise<Partial<AgentState>> {
  const nodeName = "Company Profiler";
  let logs = addLog(state.logs, nodeName, `Starting profiling for ${state.companyName}...`, "pending");
  
  try {
    const model = getModel(state);
    const prompt = `You are a senior investment researcher. Given the company name "${state.companyName}", research and provide a structured company overview.
If you know the ticker, industry, sector, describe it accurately. If the company is private, indicate that.
Return ONLY a JSON object with this exact schema (do not include markdown ticks like \`\`\`json or conversational filler):
{
  "name": "Full Official Company Name",
  "ticker": "Ticker Symbol (e.g. AAPL, or MSFT. If private, write 'PRIVATE')",
  "sector": "GICS Sector (e.g. Information Technology, Financials, Health Care)",
  "industry": "GICS Industry Group (e.g. Software & Services, Semiconductors, Pharmaceuticals)",
  "businessDescription": "A detailed 3-4 sentence description of the business model, products, and how they make money.",
  "keyProducts": ["Product 1", "Product 2", "Product 3"],
  "competitors": ["Competitor 1", "Competitor 2", "Competitor 3"]
}`;

    const response = await model.invoke(prompt);
    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    const parsed = parseJsonFromText(content) as CompanyOverview;
    
    logs = addLog(logs, nodeName, `Successfully profiled ${parsed.name} (${parsed.ticker || "N/A"}).`, "success");
    return {
      overview: parsed,
      logs,
    };
  } catch (error: any) {
    logs = addLog(logs, nodeName, `Profiling failed: ${error.message || error}`, "error");
    return { logs };
  }
}

/**
 * Node 2: Gather Financials and Recent News via Web Search
 */
export async function gatherNewsAndFinancialsNode(state: AgentState): Promise<Partial<AgentState>> {
  const nodeName = "Market Investigator";
  let logs = addLog(state.logs, nodeName, `Searching the web for news and financials...`, "pending");
  
  const companyName = state.overview?.name || state.companyName;
  const ticker = state.overview?.ticker || "";
  const tickerQuery = ticker && ticker !== "PRIVATE" ? ` (${ticker})` : "";

  try {
    // 1. Perform Searches
    const finQuery = `"${companyName}"${tickerQuery} financial metrics revenue net income P/E ratio growth 2025 2026`;
    const newsQuery = `"${companyName}"${tickerQuery} recent news stock performance market events 2026`;
    
    logs = addLog(logs, nodeName, `Executing financial search: "${finQuery}"`, "info");
    const finResults = await searchWeb(finQuery, state.tavilyApiKey);
    
    logs = addLog(logs, nodeName, `Executing news search: "${newsQuery}"`, "info");
    const newsResults = await searchWeb(newsQuery, state.tavilyApiKey);

    const combinedResults = [
      ...finResults.map(r => `[Financial Source: ${r.title}] ${r.snippet} (Link: ${r.url})`),
      ...newsResults.map(r => `[News Source: ${r.title}] ${r.snippet} (Link: ${r.url})`),
    ].join("\n\n");

    if (!combinedResults.trim()) {
      logs = addLog(logs, nodeName, `No web search results retrieved. Relying on LLM knowledge base.`, "info");
    }

    // 2. Synthesize with LLM
    const model = getModel(state);
    const prompt = `You are a senior financial analyst. Based on the company profile and these web search results, synthesize the financial metrics and list the top 4-5 key news items with sentiments.
Company Profile:
${JSON.stringify(state.overview, null, 2)}

Web Search Results:
${combinedResults || "No search results available. Use your internal knowledge base up to 2026."}

Return ONLY a JSON object in this format (do not include markdown ticks, conversational filler, or extra text):
{
  "financials": {
    "peRatio": 24.5, // number or null
    "psRatio": 4.2, // number or null
    "pbRatio": 3.1, // number or null
    "evToRevenue": 5.0, // number or null
    "evToEbitda": 14.2, // number or null
    "revenueGrowthYoY": 12.8, // percentage, e.g. 12.8 for 12.8% or null
    "earningsGrowthYoY": 9.5, // percentage or null
    "grossMargin": 65.4, // percentage or null
    "operatingMargin": 22.1, // percentage or null
    "netMargin": 18.2, // percentage or null
    "debtToEquity": 0.45, // ratio or null
    "currentRatio": 1.7, // ratio or null
    "freeCashFlow": "$1.2B (or descriptive string)",
    "dividendYield": 1.2, // percentage or null
    "marketCap": "$150B (or descriptive string)",
    "currency": "USD"
  },
  "news": [
    {
      "title": "News Headline",
      "source": "Source Name",
      "date": "Approximate Date/Time",
      "snippet": "1-2 sentence summary of what occurred.",
      "url": "URL if available",
      "sentiment": "positive" // must be "positive" or "negative" or "neutral"
    }
  ]
}`;

    const response = await model.invoke(prompt);
    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    const parsed = parseJsonFromText(content);

    logs = addLog(logs, nodeName, `Successfully retrieved and parsed financial data and ${parsed.news?.length || 0} news articles.`, "success");
    return {
      financials: parsed.financials as FinancialMetrics,
      news: parsed.news as NewsArticle[],
      logs,
    };
  } catch (error: any) {
    logs = addLog(logs, nodeName, `Failed to gather news and financials: ${error.message || error}`, "error");
    return { logs };
  }
}

/**
 * Node 3: SWOT Analysis
 */
export async function analyzeSWOTNode(state: AgentState): Promise<Partial<AgentState>> {
  const nodeName = "SWOT Strategist";
  let logs = addLog(state.logs, nodeName, `Performing SWOT Analysis...`, "pending");
  
  try {
    const model = getModel(state);
    const prompt = `You are a senior equity researcher. Based on the company overview and financials/news, generate a SWOT (Strengths, Weaknesses, Opportunities, Threats) analysis.
Company Profile:
${JSON.stringify(state.overview, null, 2)}

Financials & News:
Financials: ${JSON.stringify(state.financials, null, 2)}
News: ${JSON.stringify(state.news, null, 2)}

Return ONLY a JSON object in this format (do not include markdown ticks, conversational filler, or extra text):
{
  "strengths": ["Strength 1 (specific to their tech/moat)", "Strength 2", "Strength 3"],
  "weaknesses": ["Weakness 1 (specific to margins/debt/dependency)", "Weakness 2", "Weakness 3"],
  "opportunities": ["Opportunity 1 (expansion/markets)", "Opportunity 2", "Opportunity 3"],
  "threats": ["Threat 1 (competitors/regulatory)", "Threat 2", "Threat 3"]
}`;

    const response = await model.invoke(prompt);
    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    const parsed = parseJsonFromText(content) as SWOTAnalysis;

    logs = addLog(logs, nodeName, `Completed SWOT Analysis (identified ${parsed.strengths.length} strengths and ${parsed.threats.length} threats).`, "success");
    return {
      swot: parsed,
      logs,
    };
  } catch (error: any) {
    logs = addLog(logs, nodeName, `SWOT analysis failed: ${error.message || error}`, "error");
    return { logs };
  }
}

/**
 * Node 4: Investment Committee Decision
 */
export async function makeDecisionNode(state: AgentState): Promise<Partial<AgentState>> {
  const nodeName = "Investment Committee";
  let logs = addLog(state.logs, nodeName, `Deliberating investment decision...`, "pending");

  try {
    const model = getModel(state);
    const dossier = {
      overview: state.overview,
      financials: state.financials,
      news: state.news,
      swot: state.swot,
    };

    const prompt = `You are the Chairman of the Investment Committee. You have a full research dossier on the company "${state.companyName}":

Dossier:
${JSON.stringify(dossier, null, 2)}

Review the financials, business model, recent news sentiment, strengths, weaknesses, and competitors.
Deliver your final investment verdict:
- recommendation: BUY, HOLD, or PASS.
- score: A quantitative score from 0 (certain sell/pass) to 100 (highest conviction buy).
- targetPrice: An estimated 12-month target price (or "N/A" if private or impossible to calculate).
- investmentThesis: A clear, concise 2-3 sentence summary of the investment thesis.
- risksAndMitigations: List the top 3-4 risks and for each risk, provide a specific mitigation strategy for the company or the investor.
- keyMetricsAnalyzed: List 3-4 key metrics you evaluated (like P/E, Margins, Growth) with their value and your assessment.
- summaryMemo: A formal, professional investment memo (3-4 paragraphs) explaining your reasoning, valuation details, business prospects, and milestones to watch.

Return ONLY a JSON object in this format (do not include markdown ticks, conversational filler, or extra text):
{
  "recommendation": "BUY", // must be "BUY" or "HOLD" or "PASS"
  "score": 82, // integer 0 - 100
  "targetPrice": "$240.00", 
  "investmentThesis": "Summarize the thesis here.",
  "risksAndMitigations": [
    {
      "risk": "Risk description",
      "mitigation": "Mitigation strategy"
    }
  ],
  "keyMetricsAnalyzed": [
    {
      "metric": "Gross Margin",
      "value": "65%",
      "assessment": "Very strong, showing excellent pricing power compared to peers."
    }
  ],
  "summaryMemo": "Paragraph 1: Executive Summary and Verdict.\\n\\nParagraph 2: Financial and Business Model Assessment.\\n\\nParagraph 3: Competitive Landscape and Strategic Position.\\n\\nParagraph 4: Conclusion, Risks, and Milestones to monitor."
}`;

    const response = await model.invoke(prompt);
    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    const parsed = parseJsonFromText(content) as InvestmentDecision;

    logs = addLog(logs, nodeName, `Committee reached consensus: Recommendation is ${parsed.recommendation} with a score of ${parsed.score}/100.`, "success");
    return {
      decision: parsed,
      logs,
    };
  } catch (error: any) {
    logs = addLog(logs, nodeName, `Investment deliberation failed: ${error.message || error}`, "error");
    return { logs };
  }
}
