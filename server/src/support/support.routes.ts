import { Router } from "express";
import { DraftSchema, Provider, RequestSchema } from "./support.schema";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TavilyResult, tavilySearch } from "./tavily";

const router = Router();

function extractJsonObject(text: string) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  // Remove fenced code blocks if present
  const noFences = trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(noFences);
  } catch {
    // continue
  }

  // Best-effort: take the first JSON object span
  const firstBrace = noFences.indexOf("{");
  const lastBrace = noFences.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model did not return JSON");
  }

  const candidate = noFences.slice(firstBrace, lastBrace + 1);
  return JSON.parse(candidate);
}

function makeModel(provider: Provider) {
  if (provider === "openai") {
    return new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
    });
  }

  return new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    temperature: 0.2,
  });
}

function shouldWebSearch(ticket: string) {
  const ticketLowerCase = ticket.toLowerCase();

  if (/\b(non-?docs?|no\s+docs?)\b/.test(ticketLowerCase)) return false;

  const technicalSignals =
    /\b(docs?|documentation|oauth|oidc|redirect_uri|callback|webhook|signature|hmac|idempotenc(y|e)|integration|sdk|api|sso|saml|okta|scim)\b/;

  return technicalSignals.test(ticketLowerCase);
}

function formatSearchResults(results: TavilyResult[]) {
  if (!results.length) return "none";

  return results
    .map((res, index) => {
      const snip = res.snippet?.trim() ? res.snippet.trim() : "no snippet";

      return `#${index + 1} ${res.title}\n${res.url}\n${snip}`;
    })
    .join("\n\n");
}

function createPrompt(args: { ticket: string; searchResults: TavilyResult[] }) {
  const hasSearchResult = args.searchResults.length > 0;

  return [
    "You are a B2B support desk agent.",
    "Write a customer-ready reply.",
    "",
    "Output ONLY strict JSON with this exact shape:",
    '{ "reply": string, "sources": string[] }',
    "",
    "Rules:",
    "- Be polite, clear, short paragraphs.",
    "- Ask for missing info if needed.",
    "- Do NOT make strong promises (no guarantees).",
    hasSearchResult
      ? "- If you used any webSearch result, sources[] MUST contain 1–3 URLs FROM the provided webSearch results."
      : "- sources[] MUST be [].",
    "",
    "webSearch results:",
    formatSearchResults(args.searchResults),
    "",
    "Ticket:",
    args.ticket,
  ].join("\n");
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

function isHttpUrl(input: string) {
  try {
    const check = new URL(input);
    return check.protocol === "http:" || check.protocol === "https:";
  } catch {
    return false;
  }
}

router.post("/run", async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const { provider, text } = parsed.data;
  const ticket = text.trim();

  // set some rules -> web search ? or dont ?

  const doWebSearch = shouldWebSearch(ticket);

  let searchResults: TavilyResult[] = [];

  try {
    if (doWebSearch) {
      const ticket = text.trim();
      searchResults = await tavilySearch({ query: ticket.slice(0, 200) });
    }
  } catch {
    searchResults = [];
  }

  try {
    const model = makeModel(provider);
    const prompt = createPrompt({ ticket, searchResults });

    const out: any = await model.invoke(prompt);
    const content =
      out && typeof out === "object" && typeof out.content === "string"
        ? out.content
        : typeof out === "string"
          ? out
          : JSON.stringify(out);

    // Model is instructed to return strict JSON only.
    const draft = DraftSchema.parse(extractJsonObject(content));

    let sources = uniq(draft.sources).filter(
      (source) => typeof source === "string",
    );
    sources = sources.filter(isHttpUrl).slice(0, 3);

    if (doWebSearch && searchResults.length > 0) {
      const allowed = uniq(
        searchResults
          .map((searchRes) =>
            typeof searchRes.url === "string" ? searchRes.url.trim() : "",
          )
          .filter(Boolean),
      );

      if (sources.length === 0) {
        return res.status(422).json({
          error: "sources are empty",
        });
      }

      const badSources = sources.filter((source) => !allowed.includes(source));

      if (badSources.length > 0) {
        return res.status(422).json({
          error: "sources not allowed",
          badSources,
          allowedSources: allowed.slice(0, 3),
        });
      }

      return res.json({ reply: draft.reply, sources });
    }

    return res.json({ reply: draft.reply, sources: [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("support.run failed:", message);
    return res.status(500).json({
      error: "Support agent failed",
      message,
    });
  }
});

export default router;
