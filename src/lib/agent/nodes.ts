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

// Helper to clean raw unescaped newlines inside double-quoted JSON strings
function cleanRawNewlinesInJson(jsonStr: string): string {
  let result = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (char === '"' && !escape) {
      inString = !inString;
    }
    if (inString) {
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else {
        result += char;
      }
    } else {
      result += char;
    }
    if (char === '\\' && !escape) {
      escape = true;
    } else {
      escape = false;
    }
  }
  return result;
}

// Helper to extract JSON from model response
function parseJsonFromText(text: string): any {
  // Strip JS-style comments (both // and /* */) while preserving URLs like https://
  let cleaned = text.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, "$1");

  // Clean raw newlines inside JSON strings
  cleaned = cleanRawNewlinesInJson(cleaned);

  // Fix missing commas between objects/arrays/elements
  cleaned = cleaned.replace(/}\s*{/g, "},{");
  cleaned = cleaned.replace(/]\s*\[/g, "],[");
  cleaned = cleaned.replace(/"\s*"/g, '","');
  cleaned = cleaned.replace(/}\s*"/g, '},"');
  cleaned = cleaned.replace(/"\s*{/g, '",{');

  // Clean trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,(\s*[\]}])/g, "$1");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    const arrStart = cleaned.indexOf("[");
    const arrEnd = cleaned.lastIndexOf("]");
    if (arrStart !== -1 && arrEnd !== -1) {
      const arrStr = cleaned.slice(arrStart, arrEnd + 1);
      return JSON.parse(arrStr);
    }
    throw new Error("No JSON object or array found in LLM response:\n" + text);
  }
  const jsonStr = cleaned.slice(start, end + 1);
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

All values in the financials object should be numbers, percentages, or strings as illustrated, or null if unavailable. The sentiment field in news must be either 'positive', 'negative', or 'neutral'.

Return ONLY a JSON object in this format (do not include markdown ticks, conversational filler, or extra text):
{
  "financials": {
    "peRatio": 24.5,
    "psRatio": 4.2,
    "pbRatio": 3.1,
    "evToRevenue": 5.0,
    "evToEbitda": 14.2,
    "revenueGrowthYoY": 12.8,
    "earningsGrowthYoY": 9.5,
    "grossMargin": 65.4,
    "operatingMargin": 22.1,
    "netMargin": 18.2,
    "debtToEquity": 0.45,
    "currentRatio": 1.7,
    "freeCashFlow": "$1.2B",
    "dividendYield": 1.2,
    "marketCap": "$150B",
    "currency": "USD"
  },
  "news": [
    {
      "title": "News Headline",
      "source": "Source Name",
      "date": "Approximate Date/Time",
      "snippet": "1-2 sentence summary of what occurred.",
      "url": "URL if available",
      "sentiment": "positive"
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
- recommendation: BUY, HOLD, or PASS (must be exactly one of these).
- score: A quantitative score from 0 (certain sell/pass) to 100 (highest conviction buy).
- targetPrice: An estimated 12-month target price (or "N/A" if private or impossible to calculate).
- investmentThesis: A clear, concise 2-3 sentence summary of the investment thesis.
- risksAndMitigations: List the top 3-4 risks and for each risk, provide a specific mitigation strategy for the company or the investor.
- keyMetricsAnalyzed: List 3-4 key metrics you evaluated (like P/E, Margins, Growth) with their value and your assessment.
- summaryMemo: A formal, professional investment memo (3-4 paragraphs) explaining your reasoning, valuation details, business prospects, and milestones to watch.

CRITICAL JSON COMPLIANCE: Return ONLY a single, valid JSON block. Make sure to escape all double-quotes inside strings as \\\", never output raw unescaped newlines in your string values (use \\n instead), and ensure all elements in arrays are separated by commas. Do not write any conversational text or comments.

JSON Schema format:
{
  "recommendation": "BUY",
  "score": 82,
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
