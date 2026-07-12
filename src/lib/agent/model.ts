import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { AgentState } from "./types";

export function getModel(state: Partial<AgentState>) {
  const geminiKey = state.geminiApiKey || process.env.GEMINI_API_KEY;
  const openaiKey = state.openaiApiKey || process.env.OPENAI_API_KEY;

  if (openaiKey && openaiKey.trim() !== "") {
    return new ChatOpenAI({
      apiKey: openaiKey.trim(),
      modelName: "gpt-4o-mini",
      temperature: 0.1,
    });
  } else if (geminiKey && geminiKey.trim() !== "") {
    return new ChatGoogleGenerativeAI({
      apiKey: geminiKey.trim(),
      modelName: "gemini-2.5-flash",
      temperature: 0.1,
    });
  } else {
    // Check if there's any global env vars, otherwise throw error
    throw new Error("No LLM API Key found. Please configure a Gemini API Key or OpenAI API Key in settings or environment variables.");
  }
}
