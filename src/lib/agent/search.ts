/**
 * Web search helper that uses Tavily API if configured, 
 * or falls back to scraping DuckDuckGo HTML results.
 */
export async function searchWeb(
  query: string,
  tavilyApiKey?: string
): Promise<{ title: string; snippet: string; url: string }[]> {
  // Try Tavily if key is provided
  if (tavilyApiKey && tavilyApiKey.trim() !== "") {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyApiKey.trim(),
          query: query,
          search_depth: "basic",
          include_answer: false,
          max_results: 5,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.results.map((r: any) => ({
          title: r.title || "No Title",
          snippet: r.content || r.snippet || "",
          url: r.url || "",
        }));
      } else {
        console.warn(`Tavily search API returned status: ${response.status}. Falling back to DuckDuckGo.`);
      }
    } catch (e) {
      console.error("Tavily search error, falling back to DuckDuckGo:", e);
    }
  }

  // Fallback to DuckDuckGo HTML scraper
  try {
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`DuckDuckGo response status: ${response.status}`);
    }

    const html = await response.text();
    const results: { title: string; snippet: string; url: string }[] = [];

    // Split HTML by result__body to isolate each search result card
    const parts = html.split('class="result__body"');
    
    // Process up to 5 results
    for (let i = 1; i < parts.length && results.length < 5; i++) {
      const part = parts[i];

      // Extract URL
      const hrefMatch = part.match(/href="([^"]+)"/);
      if (!hrefMatch) continue;

      let url = hrefMatch[1];
      // Clean up DDG redirect URLs
      if (url.includes("uddg=")) {
        const match = url.match(/uddg=([^&]+)/);
        if (match) {
          url = decodeURIComponent(match[1]);
        }
      }

      // Extract Title
      const titleMatch = part.match(/class="result__link"[^>]*>([\s\S]*?)<\/a>/);
      let title = "Search Result";
      if (titleMatch) {
        title = titleMatch[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      }

      // Extract Snippet
      const snippetMatch = part.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      let snippet = "";
      if (snippetMatch) {
        snippet = snippetMatch[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      }

      if (snippet || title) {
        results.push({
          title: title || "Untitled",
          snippet: snippet || "No snippet available",
          url: url.startsWith("//") ? `https:${url}` : url,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("DuckDuckGo scraper error:", error);
    return [];
  }
}
