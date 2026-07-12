"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Building2, 
  Search, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  FileText, 
  PieChart, 
  Globe, 
  Activity, 
  Compass, 
  Layers, 
  Settings2, 
  Lock, 
  RefreshCw, 
  Play, 
  Sparkles,
  Briefcase,
  Users,
  Award,
  TrendingDown,
  Calendar,
  Copy
} from "lucide-react";
import { AgentState, AgentLog } from "@/lib/agent/types";

let confetti: any;
if (typeof window !== "undefined") {
  import("canvas-confetti").then((module) => {
    confetti = module.default;
  });
}

export default function Home() {
  // Input states
  const [companyName, setCompanyName] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [tavilyApiKey, setTavilyApiKey] = useState("");
  const [showKeys, setShowKeys] = useState(true);

  // App running state
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"decision" | "overview" | "financials" | "swot" | "news">("decision");
  const [agentState, setAgentState] = useState<AgentState>({
    companyName: "",
    logs: [],
  });

  // Clipboard copy state
  const [copiedState, setCopiedState] = useState<Record<string, boolean>>({});

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load keys from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOpenaiApiKey(localStorage.getItem("openai_api_key") || "");
      setGeminiApiKey(localStorage.getItem("gemini_api_key") || "");
      setTavilyApiKey(localStorage.getItem("tavily_api_key") || "");
      
      if (localStorage.getItem("gemini_api_key") || localStorage.getItem("openai_api_key")) {
        setShowKeys(false);
      }
    }
  }, []);

  const saveKeys = () => {
    localStorage.setItem("openai_api_key", openaiApiKey);
    localStorage.setItem("gemini_api_key", geminiApiKey);
    localStorage.setItem("tavily_api_key", tavilyApiKey);
    alert("Credentials configured and saved locally.");
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentState.logs]);

  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    if (!openaiApiKey.trim() && !geminiApiKey.trim()) {
      setError("Please configure either a Gemini or OpenAI API Key to invoke the researcher.");
      setShowKeys(true);
      return;
    }

    setIsRunning(true);
    setError(null);
    setActiveTab("decision");
    
    setAgentState({
      companyName: companyName.trim(),
      logs: [
        {
          timestamp: new Date().toLocaleTimeString(),
          node: "System",
          message: `Initializing institutional audit for: ${companyName}...`,
          status: "pending",
        },
      ],
    });

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          openaiApiKey: openaiApiKey.trim() || undefined,
          geminiApiKey: geminiApiKey.trim() || undefined,
          tavilyApiKey: tavilyApiKey.trim() || undefined,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "An error occurred starting research.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Streaming is not supported by the browser or server.");
      }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            const parsed = JSON.parse(dataStr);
            
            if (parsed.error) {
              throw new Error(parsed.error.error || "Execution error occurred.");
            }

            const nodeName = Object.keys(parsed)[0];
            const updates = parsed[nodeName];

            setAgentState((prev) => {
              const next = { ...prev };
              if (updates.logs) {
                next.logs = updates.logs;
              }
              if (updates.overview) next.overview = updates.overview;
              if (updates.financials) next.financials = updates.financials;
              if (updates.news) next.news = updates.news;
              if (updates.swot) next.swot = updates.swot;
              if (updates.decision) {
                next.decision = updates.decision;
                if (updates.decision.recommendation === "BUY" && confetti) {
                  confetti({
                    particleCount: 120,
                    spread: 80,
                    origin: { y: 0.65 },
                    colors: ["#10b981", "#3b82f6", "#6366f1", "#f59e0b"],
                  });
                }
              }
              return next;
            });
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Audit failed. Please verify API key validity.");
      setAgentState((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          {
            timestamp: new Date().toLocaleTimeString(),
            node: "System",
            message: `Execution terminated: ${err.message || err}`,
            status: "error",
          },
        ],
      }));
    } finally {
      setIsRunning(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    if (typeof window === "undefined" || !navigator?.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedState(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedState(prev => ({ ...prev, [key]: false }));
      }, 2000);
    });
  };

  const getStatusIcon = (status: AgentLog["status"]) => {
    switch (status) {
      case "pending":
        return <RefreshCw className="spinner" size={14} style={{ color: "var(--info)" }} />;
      case "success":
        return <CheckCircle2 size={14} style={{ color: "var(--success)" }} />;
      case "error":
        return <AlertTriangle size={14} style={{ color: "var(--danger)" }} />;
      case "info":
      default:
        return <Info size={14} style={{ color: "var(--secondary)" }} />;
    }
  };

  // Helper to parse percentages/ratios for horizontal mini progress bars
  const getMarginScore = (valStr: string | null | undefined, type: "gross" | "operating" | "growth") => {
    if (!valStr) return { pct: 40, status: "moderate" };
    const num = parseFloat(valStr.replace(/[^\d.-]/g, ""));
    if (isNaN(num)) return { pct: 40, status: "moderate" };
    
    let pct = Math.max(0, Math.min(100, num));
    if (type === "operating") {
      pct = Math.min(100, Math.max(0, (num / 40) * 100)); // Scale up to 40% margin
      return { pct, status: num > 15 ? "good" : num > 5 ? "moderate" : "poor" };
    }
    if (type === "growth") {
      pct = Math.min(100, Math.max(0, ((num + 15) / 50) * 100)); // Scale -15% to 35% growth
      return { pct, status: num > 12 ? "good" : num > 0 ? "moderate" : "poor" };
    }
    // Gross margin
    return { pct, status: num > 40 ? "good" : num > 20 ? "moderate" : "poor" };
  };

  // Helper to compute news sentiment distribution percentages
  const getSentimentBreakdown = (newsItems: typeof agentState.news) => {
    if (!newsItems || newsItems.length === 0) return null;
    const positive = newsItems.filter(n => n.sentiment?.toLowerCase() === "positive").length;
    const neutral = newsItems.filter(n => n.sentiment?.toLowerCase() === "neutral" || !n.sentiment).length;
    const negative = newsItems.filter(n => n.sentiment?.toLowerCase() === "negative").length;
    const total = newsItems.length;
    return {
      positive,
      neutral,
      negative,
      total,
      posPct: (positive / total) * 100,
      neuPct: (neutral / total) * 100,
      negPct: (negative / total) * 100
    };
  };

  const sentimentData = getSentimentBreakdown(agentState.news);

  // Conviction Score svg parameters
  const scoreVal = agentState.decision?.score || 0;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scoreVal / 100) * circumference;

  // Format SWOT for copying
  const formatSwotForCopy = () => {
    if (!agentState.swot) return "";
    const s = agentState.swot.strengths.map(x => `- ${x}`).join("\n");
    const w = agentState.swot.weaknesses.map(x => `- ${x}`).join("\n");
    const o = agentState.swot.opportunities.map(x => `- ${x}`).join("\n");
    const t = agentState.swot.threats.map(x => `- ${x}`).join("\n");
    return `### SWOT Report: ${agentState.overview?.name || "Target"}\n\nSTRENGTHS:\n${s}\n\nWEAKNESSES:\n${w}\n\nOPPORTUNITIES:\n${o}\n\nTHREATS:\n${t}`;
  };

  // Format Financials for copying
  const formatFinancialsForCopy = () => {
    if (!agentState.financials) return "";
    const f = agentState.financials;
    return `Financials Report: ${agentState.overview?.name || "Target"} (Currency: ${f.currency || "USD"})\n` +
      `Market Cap: ${f.marketCap || "N/A"}\n` +
      `P/E Ratio: ${f.peRatio || "N/A"}\n` +
      `P/S Ratio: ${f.psRatio || "N/A"}\n` +
      `EV/Revenue: ${f.evToRevenue || "N/A"}\n` +
      `EV/EBITDA: ${f.evToEbitda || "N/A"}\n` +
      `Gross Margin: ${f.grossMargin || "N/A"}%\n` +
      `Operating Margin: ${f.operatingMargin || "N/A"}%\n` +
      `Revenue Growth YoY: ${f.revenueGrowthYoY || "N/A"}%\n` +
      `Earnings Growth YoY: ${f.earningsGrowthYoY || "N/A"}%\n` +
      `Debt to Equity: ${f.debtToEquity || "N/A"}\n` +
      `Current Ratio: ${f.currentRatio || "N/A"}\n` +
      `Free Cash Flow: ${f.freeCashFlow || "N/A"}`;
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-container">
          <span className="logo-icon">
            <TrendingUp size={20} strokeWidth={3} />
          </span>
          <span className="logo-text">AegisInvest</span>
          <span className="logo-tag">Equity Agent v1.0</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button 
            className="btn btn-secondary" 
            style={{ width: "auto", padding: "0.5rem 0.875rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.35rem" }}
            onClick={() => setShowKeys(!showKeys)}
          >
            <Settings2 size={14} />
            {showKeys ? "Hide Credentials" : "API Credentials"}
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <div className="dashboard-layout">
        {/* Sidebar Controls */}
        <aside className="sidebar">
          {/* API Keys Configuration Card */}
          {showKeys && (
            <div className="card animate-fade" style={{ borderColor: "var(--secondary)", backgroundColor: "#faf9ff" }}>
              <div className="card-title" style={{ fontSize: "0.825rem", color: "var(--secondary-text)", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(99, 102, 241, 0.1)" }}>
                <Lock size={14} />
                Access Configuration
              </div>
              
              <div className="form-group">
                <label className="form-label">Gemini API Key</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="AIzaSy..." 
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">OpenAI API Key (Optional)</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="sk-..." 
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tavily Search Key (Optional)</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="tvly-..." 
                  value={tavilyApiKey}
                  onChange={(e) => setTavilyApiKey(e.target.value)}
                />
                <span style={{ fontSize: "0.6875rem", color: "var(--text-light)", lineHeight: 1.3 }}>
                  Omitting Tavily triggers the internal DuckDuckGo free search scraper.
                </span>
              </div>

              <button className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "0.5rem" }} onClick={saveKeys}>
                Apply & Save Keys
              </button>
            </div>
          )}

          {/* Research Input Card */}
          <div className="card">
            <div className="card-title">
              <Search size={16} />
              Equity Research
            </div>
            <form onSubmit={handleResearch} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div className="form-group">
                <label className="form-label">Target Name / Ticker</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Tesla, Nvidia, Reliance..." 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isRunning}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={isRunning || !companyName.trim()}>
                {isRunning ? (
                  <>
                    <RefreshCw className="spinner" size={14} />
                    Profiling target...
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Run Audit Graph
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Live Node Progress Terminal */}
          <div className="card" style={{ flex: 1, minHeight: "260px" }}>
            <div className="card-title" style={{ justifyContent: "space-between" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                <Activity size={16} />
                Graph Execution Logs
              </span>
              {isRunning && <span className="pulse-indicator" />}
            </div>
            <div className="logs-panel">
              {agentState.logs.length === 0 ? (
                <div style={{ color: "var(--text-light)", fontSize: "0.725rem", textAlign: "center", padding: "2rem 0" }}>
                  Start an audit run to stream active graph node state transitions.
                </div>
              ) : (
                agentState.logs.map((log, idx) => (
                  <div key={idx} className={`log-item ${log.status}`}>
                    <span className="log-time">{log.timestamp}</span>
                    {getStatusIcon(log.status)}
                    <span className="log-node">[{log.node}]</span>
                    <span className="log-msg">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </aside>

        {/* Main Work Area */}
        <main className="main-content">
          <div className="content-inner">
            {error && (
              <div className="card" style={{ borderColor: "var(--danger)", backgroundColor: "var(--danger-light)", color: "var(--danger-text)", gap: "0.5rem", padding: "1.25rem" }}>
                <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                  <AlertTriangle size={16} />
                  Execution Fault
                </div>
                <p style={{ fontSize: "0.8rem" }}>{error}</p>
              </div>
            )}

            {/* Welcome Screen */}
            {!agentState.overview && !isRunning && !error && (
              <div className="welcome-container animate-fade">
                <div className="welcome-icon">
                  <Sparkles size={36} />
                </div>
                <h1 className="welcome-title">Autonomous Equity Research Agent</h1>
                <p className="welcome-desc">
                  Input any global company to kick off a multi-stage LangGraph workflow. The agent constructs institutional business profiles, parses financial statements, builds a SWOT matrix, audits risk logs, and reaches an investment committee consensus.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", width: "100%", marginTop: "1rem" }}>
                  <div className="metric-card" style={{ alignItems: "center", textAlign: "center" }}>
                    <Layers size={20} style={{ color: "var(--secondary)" }} />
                    <div style={{ fontWeight: 700, fontSize: "0.825rem", marginTop: "0.5rem" }}>LangGraph State Graph</div>
                    <div style={{ fontSize: "0.725rem", color: "var(--text-light)", marginTop: "0.125rem" }}>Sequential data parsing channels</div>
                  </div>
                  <div className="metric-card" style={{ alignItems: "center", textAlign: "center" }}>
                    <Globe size={20} style={{ color: "var(--primary)" }} />
                    <div style={{ fontWeight: 700, fontSize: "0.825rem", marginTop: "0.5rem" }}>Multi-Source Scraping</div>
                    <div style={{ fontSize: "0.725rem", color: "var(--text-light)", marginTop: "0.125rem" }}>Real-time financials and news flow</div>
                  </div>
                </div>
              </div>
            )}

            {/* Running Loader */}
            {isRunning && !agentState.overview && (
              <div className="welcome-container animate-fade">
                <div className="welcome-icon" style={{ backgroundColor: "var(--secondary-light)", color: "var(--secondary)" }}>
                  <RefreshCw className="spinner" size={32} />
                </div>
                <h1 className="welcome-title">Assembling Company Profile...</h1>
                <p className="welcome-desc">
                  The researcher is scraping business registers and financials. Follow node updates inside the core sidebar logs.
                </p>
              </div>
            )}

            {/* Results Dossier */}
            {agentState.overview && (
              <div className="animate-fade" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Header Banner */}
                <div className="card glass-card" style={{ padding: "1.25rem 1.75rem", flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                      <Building2 size={20} style={{ color: "var(--primary)" }} />
                      <h2 style={{ fontSize: "1.35rem", fontWeight: 900, letterSpacing: "-0.02em" }}>{agentState.overview.name}</h2>
                      {agentState.overview.ticker && (
                        <span className="badge badge-neutral">{agentState.overview.ticker}</span>
                      )}
                    </div>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.125rem", fontWeight: 550 }}>
                      {agentState.overview.sector} • {agentState.overview.industry}
                    </p>
                  </div>
                  {isRunning && (
                    <span className="badge badge-info animate-pulse-slow">
                      <RefreshCw className="spinner" size={10} />
                      Refining Model...
                    </span>
                  )}
                </div>

                {/* Tabs Panel */}
                <nav className="tabs-container">
                  <button 
                    className={`tab-btn ${activeTab === "decision" ? "active" : ""}`}
                    onClick={() => setActiveTab("decision")}
                  >
                    <Award size={15} />
                    Committee Verdict
                  </button>
                  <button 
                    className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
                    onClick={() => setActiveTab("overview")}
                  >
                    <Briefcase size={15} />
                    Business Profile
                  </button>
                  <button 
                    className={`tab-btn ${activeTab === "financials" ? "active" : ""}`}
                    onClick={() => setActiveTab("financials")}
                  >
                    <PieChart size={15} />
                    Key Ratios
                  </button>
                  <button 
                    className={`tab-btn ${activeTab === "swot" ? "active" : ""}`}
                    onClick={() => setActiveTab("swot")}
                  >
                    <Layers size={15} />
                    SWOT Analysis
                  </button>
                  <button 
                    className={`tab-btn ${activeTab === "news" ? "active" : ""}`}
                    onClick={() => setActiveTab("news")}
                  >
                    <Globe size={15} />
                    News & Sentiment
                  </button>
                </nav>

                {/* Main Tab Panels */}
                <div style={{ minHeight: "380px" }}>
                  
                  {/* TAB: DECISION */}
                  {activeTab === "decision" && (
                    <div className="animate-fade" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                      {agentState.decision ? (
                        <>
                          {/* Top Verdict Details Card */}
                          <div className="card">
                            <div className="decision-header">
                              <div className="decision-verdict">
                                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Verdict Rating:</span>
                                <span className={`recommendation-banner ${agentState.decision.recommendation}`}>
                                  {agentState.decision.recommendation}
                                </span>
                              </div>
                              
                              <div className="score-container">
                                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Conviction Score:</span>
                                
                                {/* SVG Circular Gauge */}
                                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                  <svg className="gauge-svg" width="64" height="64" viewBox="0 0 60 60">
                                    <circle className="gauge-bg" cx="30" cy="30" r="24" strokeWidth="4" fill="transparent" />
                                    <circle 
                                      className={`gauge-fill ${agentState.decision.recommendation}`} 
                                      cx="30" 
                                      cy="30" 
                                      r="24" 
                                      stroke="currentColor" 
                                      strokeWidth="4" 
                                      fill="transparent"
                                      strokeDasharray={circumference} 
                                      strokeDashoffset={strokeDashoffset} 
                                      strokeLinecap="round" 
                                      transform="rotate(-90 30 30)" 
                                    />
                                    <text x="30" y="34" textAnchor="middle" className="gauge-text" fontSize="10" fontWeight="900">
                                      {scoreVal}
                                    </text>
                                  </svg>
                                </div>

                                {agentState.decision.targetPrice && agentState.decision.targetPrice !== "N/A" && (
                                  <div style={{ borderLeft: "1px solid var(--card-border)", paddingLeft: "1.25rem" }}>
                                    <div style={{ fontSize: "0.725rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>12M Target</div>
                                    <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--text-main)", marginTop: "0.125rem" }}>{agentState.decision.targetPrice}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                                <h4 style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  Executive Thesis
                                </h4>
                                <button 
                                  className="btn btn-secondary btn-copy" 
                                  style={{ width: "auto", padding: "0.25rem 0.5rem", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                                  onClick={() => copyToClipboard(agentState.decision?.investmentThesis || "", "thesis")}
                                >
                                  {copiedState["thesis"] ? <CheckCircle2 size={12} style={{ color: "var(--success)" }} /> : <Copy size={12} />}
                                  {copiedState["thesis"] ? "Copied!" : "Copy"}
                                </button>
                              </div>
                              <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", lineHeight: 1.5, fontStyle: "italic" }}>
                                "{agentState.decision.investmentThesis}"
                              </p>
                            </div>
                          </div>

                          {/* Detail Grid */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.25rem" }}>
                            
                            {/* Ratios deliberated */}
                            <div className="card">
                              <h4 className="card-title">
                                <PieChart size={16} />
                                Deliberated Ratios
                              </h4>
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                {agentState.decision.keyMetricsAnalyzed.map((metric, idx) => (
                                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f8fafc", paddingBottom: "0.5rem", alignItems: "center" }}>
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: "0.825rem", color: "var(--text-main)" }}>{metric.metric}</div>
                                      <div style={{ fontSize: "0.725rem", color: "var(--text-muted)" }}>{metric.assessment}</div>
                                    </div>
                                    <span className="badge badge-neutral" style={{ fontSize: "0.6875rem" }}>{metric.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Risk Mitigation log */}
                            <div className="card">
                              <h4 className="card-title">
                                <AlertTriangle size={16} />
                                Audited Risk Log
                              </h4>
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                                {agentState.decision.risksAndMitigations.map((item, idx) => (
                                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.825rem", color: "var(--danger-text)", display: "flex", gap: "0.35rem", alignItems: "center" }}>
                                      <TrendingDown size={12} />
                                      {item.risk}
                                    </div>
                                    <div style={{ fontSize: "0.775rem", color: "var(--text-muted)", paddingLeft: "1rem", borderLeft: "2px solid #fee2e2" }}>
                                      <strong>Mitigation:</strong> {item.mitigation}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Committee Memo */}
                          <div className="card">
                            <div className="card-title" style={{ justifyContent: "space-between" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                                <FileText size={16} />
                                Formal Investment Committee Memorandum
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <button 
                                  className="btn btn-secondary btn-copy" 
                                  style={{ width: "auto", padding: "0.25rem 0.5rem", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                                  onClick={() => copyToClipboard(agentState.decision?.summaryMemo || "", "memo")}
                                >
                                  {copiedState["memo"] ? <CheckCircle2 size={12} style={{ color: "var(--success)" }} /> : <Copy size={12} />}
                                  {copiedState["memo"] ? "Copied Memorandum!" : "Copy Memo"}
                                </button>
                                <span style={{ fontSize: "0.7rem", color: "var(--text-light)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                  <Calendar size={12} />
                                  Q3 2026 Audit
                                </span>
                              </div>
                            </div>
                            <div className="memo-text">
                              {agentState.decision.summaryMemo}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="card" style={{ alignItems: "center", padding: "4rem 2rem", textAlign: "center" }}>
                          <RefreshCw className="spinner" size={28} style={{ color: "var(--info)", marginBottom: "1rem" }} />
                          <h4 style={{ fontWeight: 700, fontSize: "0.9rem" }}>Synthesizing Consensus...</h4>
                          <p style={{ fontSize: "0.775rem", color: "var(--text-light)", marginTop: "0.25rem" }}>
                            The committee is analyzing news flow and multiple targets.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: BUSINESS PROFILE */}
                  {activeTab === "overview" && (
                    <div className="animate-fade" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                      <div className="card">
                        <h4 className="card-title">
                          <Building2 size={16} />
                          Business Description
                        </h4>
                        <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "var(--text-muted)" }}>
                          {agentState.overview.businessDescription}
                        </p>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                        <div className="card">
                          <h4 className="card-title">
                            <Layers size={16} />
                            Key Offerings & Segments
                          </h4>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                            {agentState.overview.keyProducts.map((p, idx) => (
                              <span key={idx} className="badge badge-info" style={{ fontSize: "0.725rem", padding: "0.35rem 0.75rem", textTransform: "none" }}>
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="card">
                          <h4 className="card-title">
                            <Users size={16} />
                            Competitor Landscape
                          </h4>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                            {agentState.overview.competitors.map((c, idx) => (
                              <span key={idx} className="badge badge-warning" style={{ fontSize: "0.725rem", padding: "0.35rem 0.75rem", textTransform: "none" }}>
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB: RATIOS */}
                  {activeTab === "financials" && (
                    <div className="animate-fade">
                      {agentState.financials ? (
                        <div className="card">
                          <div className="card-title" style={{ justifyContent: "space-between" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                              <PieChart size={16} />
                              Key Financial Ratios (Currency: {agentState.financials.currency || "USD"})
                            </span>
                            <button 
                              className="btn btn-secondary btn-copy" 
                              style={{ width: "auto", padding: "0.25rem 0.5rem", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                              onClick={() => copyToClipboard(formatFinancialsForCopy(), "financials")}
                            >
                              {copiedState["financials"] ? <CheckCircle2 size={12} style={{ color: "var(--success)" }} /> : <Copy size={12} />}
                              {copiedState["financials"] ? "Copied Ratios!" : "Copy Report"}
                            </button>
                          </div>
                          <div className="metrics-grid">
                            
                            {/* Valuation Multiples */}
                            <div className="metric-card">
                              <span className="metric-label">P/E Ratio</span>
                              <span className="metric-value">{agentState.financials.peRatio ? `${agentState.financials.peRatio}x` : "N/A"}</span>
                              <div style={{ fontSize: "0.6875rem", color: "var(--text-light)" }}>Price to Earnings</div>
                            </div>
                            
                            <div className="metric-card">
                              <span className="metric-label">P/S Ratio</span>
                              <span className="metric-value">{agentState.financials.psRatio ? `${agentState.financials.psRatio}x` : "N/A"}</span>
                              <div style={{ fontSize: "0.6875rem", color: "var(--text-light)" }}>Price to Sales</div>
                            </div>

                            <div className="metric-card">
                              <span className="metric-label">EV / Revenue</span>
                              <span className="metric-value">{agentState.financials.evToRevenue ? `${agentState.financials.evToRevenue}x` : "N/A"}</span>
                              <div style={{ fontSize: "0.6875rem", color: "var(--text-light)" }}>Enterprise Value to Sales</div>
                            </div>

                            <div className="metric-card">
                              <span className="metric-label">EV / EBITDA</span>
                              <span className="metric-value">{agentState.financials.evToEbitda ? `${agentState.financials.evToEbitda}x` : "N/A"}</span>
                              <div style={{ fontSize: "0.6875rem", color: "var(--text-light)" }}>Enterprise Value to EBITDA</div>
                            </div>

                            {/* Margins with Mini Track Bar */}
                            {(() => {
                              const score = getMarginScore(agentState.financials.grossMargin, "gross");
                              return (
                                <div className="metric-card">
                                  <span className="metric-label" style={{ display: "flex", justifyContent: "space-between" }}>
                                    Gross Margin
                                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: `var(--${score.status})` }}>{score.status}</span>
                                  </span>
                                  <span className="metric-value">{agentState.financials.grossMargin ? `${agentState.financials.grossMargin}%` : "N/A"}</span>
                                  <div className="mini-track">
                                    <div className={`mini-bar ${score.status}`} style={{ width: `${score.pct}%` }} />
                                  </div>
                                </div>
                              );
                            })()}

                            {(() => {
                              const score = getMarginScore(agentState.financials.operatingMargin, "operating");
                              return (
                                <div className="metric-card">
                                  <span className="metric-label" style={{ display: "flex", justifyContent: "space-between" }}>
                                    Operating Margin
                                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: `var(--${score.status})` }}>{score.status}</span>
                                  </span>
                                  <span className="metric-value">{agentState.financials.operatingMargin ? `${agentState.financials.operatingMargin}%` : "N/A"}</span>
                                  <div className="mini-track">
                                    <div className={`mini-bar ${score.status}`} style={{ width: `${score.pct}%` }} />
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Growth Indicators with Mini Track */}
                            {(() => {
                              const score = getMarginScore(agentState.financials.revenueGrowthYoY, "growth");
                              return (
                                <div className="metric-card">
                                  <span className="metric-label" style={{ display: "flex", justifyContent: "space-between" }}>
                                    YoY Revenue Growth
                                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: `var(--${score.status})` }}>{score.status}</span>
                                  </span>
                                  <span className="metric-value">{agentState.financials.revenueGrowthYoY ? `${agentState.financials.revenueGrowthYoY}%` : "N/A"}</span>
                                  <div className="mini-track">
                                    <div className={`mini-bar ${score.status}`} style={{ width: `${score.pct}%` }} />
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="metric-card">
                              <span className="metric-label">YoY Earnings Growth</span>
                              <span className="metric-value">{agentState.financials.earningsGrowthYoY ? `${agentState.financials.earningsGrowthYoY}%` : "N/A"}</span>
                              <div style={{ fontSize: "0.6875rem", color: "var(--text-light)" }}>YoY EPS Change</div>
                            </div>

                            {/* Debt and liquidity */}
                            <div className="metric-card">
                              <span className="metric-label">Debt to Equity</span>
                              <span className="metric-value">{agentState.financials.debtToEquity || "N/A"}</span>
                              <div style={{ fontSize: "0.6875rem", color: "var(--text-light)" }}>Leverage multiplier</div>
                            </div>

                            <div className="metric-card">
                              <span className="metric-label">Current Ratio</span>
                              <span className="metric-value">{agentState.financials.currentRatio || "N/A"}</span>
                              <div style={{ fontSize: "0.6875rem", color: "var(--text-light)" }}>Short-term liquidity</div>
                            </div>

                            <div className="metric-card">
                              <span className="metric-label">Market Capitalization</span>
                              <span className="metric-value" style={{ fontSize: "1.1rem" }}>{agentState.financials.marketCap || "N/A"}</span>
                              <div style={{ fontSize: "0.6875rem", color: "var(--text-light)" }}>Total Equity Value</div>
                            </div>

                            <div className="metric-card">
                              <span className="metric-label">Free Cash Flow</span>
                              <span className="metric-value" style={{ fontSize: "1.1rem" }}>{agentState.financials.freeCashFlow || "N/A"}</span>
                              <div style={{ fontSize: "0.6875rem", color: "var(--text-light)" }}>FCF LTM</div>
                            </div>

                          </div>
                        </div>
                      ) : (
                        <div className="card" style={{ alignItems: "center", padding: "4rem 2rem", textAlign: "center" }}>
                          <RefreshCw className="spinner" size={28} style={{ color: "var(--info)", marginBottom: "1rem" }} />
                          <h4 style={{ fontWeight: 700, fontSize: "0.9rem" }}>Extracting Financial Statements...</h4>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: SWOT */}
                  {activeTab === "swot" && (
                    <div className="animate-fade">
                      {agentState.swot ? (
                        <div className="card">
                          <div className="card-title" style={{ justifyContent: "space-between" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                              <Layers size={16} />
                              Strategic SWOT Matrix
                            </span>
                            <button 
                              className="btn btn-secondary btn-copy" 
                              style={{ width: "auto", padding: "0.25rem 0.5rem", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                              onClick={() => copyToClipboard(formatSwotForCopy(), "swot")}
                            >
                              {copiedState["swot"] ? <CheckCircle2 size={12} style={{ color: "var(--success)" }} /> : <Copy size={12} />}
                              {copiedState["swot"] ? "Copied Matrix!" : "Copy Matrix"}
                            </button>
                          </div>
                          <div className="swot-grid">
                            <div className="swot-box strengths">
                              <div className="swot-header">
                                <Sparkles size={14} />
                                Strengths (S)
                              </div>
                              <ul className="swot-list">
                                {agentState.swot.strengths.map((s, idx) => (
                                  <li key={idx} className="swot-item">{s}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="swot-box weaknesses">
                              <div className="swot-header">
                                <AlertTriangle size={14} />
                                Weaknesses (W)
                              </div>
                              <ul className="swot-list">
                                {agentState.swot.weaknesses.map((w, idx) => (
                                  <li key={idx} className="swot-item">{w}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="swot-box opportunities">
                              <div className="swot-header">
                                <Compass size={14} />
                                Opportunities (O)
                              </div>
                              <ul className="swot-list">
                                {agentState.swot.opportunities.map((o, idx) => (
                                  <li key={idx} className="swot-item">{o}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="swot-box threats">
                              <div className="swot-header">
                                <AlertTriangle size={14} />
                                Threats (T)
                              </div>
                              <ul className="swot-list">
                                {agentState.swot.threats.map((t, idx) => (
                                  <li key={idx} className="swot-item">{t}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="card" style={{ alignItems: "center", padding: "4rem 2rem", textAlign: "center" }}>
                          <RefreshCw className="spinner" size={28} style={{ color: "var(--info)", marginBottom: "1rem" }} />
                          <h4 style={{ fontWeight: 700, fontSize: "0.9rem" }}>Performing Strategic SWOT Audit...</h4>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: NEWS */}
                  {activeTab === "news" && (
                    <div className="animate-fade">
                      {agentState.news ? (
                        <div className="card">
                          <h4 className="card-title">
                            <Globe size={16} />
                            Scraped News & Sentiment Index
                          </h4>
                          
                          {/* Segmented Sentiment distribution bar */}
                          {sentimentData && (
                            <div style={{ backgroundColor: "#f8fafc", padding: "1rem 1.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--card-border)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                <span>Sentiment Distribution</span>
                                <span style={{ display: "inline-flex", gap: "0.75rem" }}>
                                  <span style={{ color: "var(--success)" }}>Positive: {sentimentData.positive} ({Math.round(sentimentData.posPct)}%)</span>
                                  <span style={{ color: "#94a3b8" }}>Neutral: {sentimentData.neutral} ({Math.round(sentimentData.neuPct)}%)</span>
                                  <span style={{ color: "var(--danger)" }}>Negative: {sentimentData.negative} ({Math.round(sentimentData.negPct)}%)</span>
                                </span>
                              </div>
                              
                              <div className="sentiment-bar-container">
                                <div className="sentiment-segment positive" style={{ width: `${sentimentData.posPct}%` }} />
                                <div className="sentiment-segment neutral" style={{ width: `${sentimentData.neuPct}%` }} />
                                <div className="sentiment-segment negative" style={{ width: `${sentimentData.negPct}%` }} />
                              </div>
                            </div>
                          )}

                          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
                            {agentState.news.map((item, idx) => (
                              <div key={idx} style={{ padding: "0.875rem 1.125rem", border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", backgroundColor: "#ffffff" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minWidth: "260px" }}>
                                  <span style={{ fontSize: "0.7rem", color: "var(--text-light)", fontWeight: 550 }}>
                                    {item.source} • {item.date}
                                  </span>
                                  <h5 style={{ fontWeight: 750, fontSize: "0.85rem" }}>
                                    {item.url ? (
                                      <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--secondary)", textDecoration: "underline" }}>
                                        {item.title}
                                      </a>
                                    ) : (
                                      item.title
                                    )}
                                  </h5>
                                  <p style={{ fontSize: "0.775rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                                    {item.snippet}
                                  </p>
                                </div>
                                <span className={`badge badge-${item.sentiment || "neutral"}`} style={{ fontSize: "0.625rem" }}>
                                  {item.sentiment || "neutral"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="card" style={{ alignItems: "center", padding: "4rem 2rem", textAlign: "center" }}>
                          <RefreshCw className="spinner" size={28} style={{ color: "var(--info)", marginBottom: "1rem" }} />
                          <h4 style={{ fontWeight: 700, fontSize: "0.9rem" }}>Scraping news headlines and sentiment logs...</h4>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
