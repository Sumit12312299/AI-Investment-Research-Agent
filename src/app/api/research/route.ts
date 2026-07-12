import { NextRequest, NextResponse } from "next/server";
import { investmentGraph } from "@/lib/agent/graph";

// Disable body parsing size limits and enable streaming
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyName, openaiApiKey, geminiApiKey, tavilyApiKey, stream } = body;

    if (!companyName || companyName.trim() === "") {
      return NextResponse.json(
        { error: "Company name is required." },
        { status: 400 }
      );
    }

    const inputs = {
      companyName: companyName.trim(),
      openaiApiKey: openaiApiKey?.trim() || "",
      geminiApiKey: geminiApiKey?.trim() || "",
      tavilyApiKey: tavilyApiKey?.trim() || "",
      logs: [],
    };

    // If client requested streaming
    if (stream === true || req.headers.get("accept") === "text/event-stream") {
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          try {
            // Get streaming updates from LangGraph
            const graphStream = await investmentGraph.stream(inputs, {
              streamMode: "updates",
            });

            for await (const update of graphStream) {
              // Send the update to the client as Server-Sent Event (SSE)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`));
            }
            controller.close();
          } catch (err: any) {
            console.error("Stream execution error:", err);
            const errorObj = { error: err.message || "An error occurred during agent execution." };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorObj })}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(customStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // Otherwise, execute synchronously and return the final state
    const result = await investmentGraph.invoke(inputs);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Research API error:", error);
    return NextResponse.json(
      { error: error.message || "An internal error occurred." },
      { status: 500 }
    );
  }
}
