import Anthropic from "@anthropic-ai/sdk";
import { getCards, getChannels } from "@/lib/metrics";
import { defaultFilters, type CardFilters } from "@/lib/queries/cards";
import { getSettings } from "@/lib/settings/store";
import { enforceCountry } from "@/lib/auth/access";

const SYSTEM = `You are the AI analyst of Sanalytics (an e-commerce store with delivery, markets KZ/UZ/KG/TJ/MN).
You answer questions from executives and marketers using REAL data that you get only through tools.

Data model:
- Order channel: the storefront the order was placed through: store, marketplace_a, marketplace_b, express.
- User channel: where the user signed up: app, web, partner.
- Country: the user's country (KZ Kazakhstan, UZ Uzbekistan, KG Kyrgyzstan, TJ Tajikistan, MN Mongolia).
- Metrics: sign-ups, buyers (placed an order), orders, average check, weight (kg), revenue. Currency is USD.
- Conversion = buyers / sign-ups, and it makes sense ONLY with a sign-up period (cohort): then buyers belong to the cohort. Without a cohort do not compute conversion.
- Revenue: gross (sum of prices) or paid. Gross by default.
- B2B: business accounts (>50 orders a month) can be excluded.

Rules:
- Base answers ONLY on numbers from the tools. NEVER make up numbers.
- Always state which slice you used (period, country, channels).
- Answer in the user's language, briefly and to the point.
- This is a demo: the data is synthetic but computed by the same metrics layer as in production.
- If no period is given, ask or pick a reasonable one (for example the last 30 days) and say so.
- For "which channel is best/biggest" questions use get_channels.
- For comparisons (month over month, channel vs channel) call the tool several times.
- You are read-only: you never change anything or write to databases.`;

const tools: Anthropic.Tool[] = [
  {
    name: "get_metrics",
    description:
      "Key metrics for a period and slice: sign-ups, buyers, conversion (cohort only), orders, average check, weight, revenue.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "order period start YYYY-MM-DD" },
        to: { type: "string", description: "order period end YYYY-MM-DD (inclusive)" },
        country: { type: "string", enum: ["KZ", "UZ", "KG", "TJ", "MN", "all"], description: "user country" },
        orderCreator: { type: "string", description: "order channel or 'all'" },
        userCreator: { type: "string", description: "sign-up channel or 'all'" },
        basis: { type: "string", enum: ["gross", "paid"], description: "revenue gross or paid" },
        excludeB2b: { type: "boolean", description: "exclude business accounts" },
        regFrom: { type: "string", description: "sign-up period (cohort) from YYYY-MM-DD, optional" },
        regTo: { type: "string", description: "sign-up period (cohort) to YYYY-MM-DD, optional" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "get_channels",
    description: "Breakdown by order channel for a period: orders, buyers, revenue. For questions about which channel is best or biggest.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "period start YYYY-MM-DD" },
        to: { type: "string", description: "period end YYYY-MM-DD (inclusive)" },
        country: { type: "string", enum: ["KZ", "UZ", "KG", "TJ", "MN", "all"] },
        basis: { type: "string", enum: ["gross", "paid"] },
        excludeB2b: { type: "boolean" },
      },
      required: ["from", "to"],
    },
  },
];

function buildFilters(input: Record<string, unknown>): CardFilters {
  const d = defaultFilters();
  const str = (v: unknown, def: string) => (typeof v === "string" && v ? v : def);
  return {
    ...d,
    from: str(input.from, d.from),
    to: str(input.to, d.to),
    country: str(input.country, "all"),
    orderCreator: str(input.orderCreator, "all"),
    userCreator: str(input.userCreator, "all"),
    regFrom: str(input.regFrom, ""),
    regTo: str(input.regTo, ""),
    basis: input.basis === "paid" ? "paid" : "gross",
    excludeB2b: input.excludeB2b === true,
  };
}

async function runTool(name: string, input: Record<string, unknown>) {
  if (name === "get_metrics") {
    const f = buildFilters(input);
    f.country = await enforceCountry(f.country);
    const res = await getCards(f);
    return {
      slice: { period: `${f.from}..${f.to}`, country: f.country, orderChannel: f.orderCreator, userChannel: f.userCreator, cohort: f.regFrom ? `${f.regFrom}..${f.regTo}` : null, revenue: f.basis, excludeB2b: f.excludeB2b },
      metrics: res.cards.map((c) => ({ metric: c.title, value: c.value, delta: c.deltaPct })),
      error: res.error,
    };
  }
  if (name === "get_channels") {
    const f = buildFilters(input);
    f.country = await enforceCountry(f.country);
    const res = await getChannels(f);
    return {
      slice: { period: `${f.from}..${f.to}`, country: f.country, revenue: f.basis },
      channels: res.channels.map((c) => ({ channel: c.channel, orders: c.orders, buyers: c.buyers, revenue: c.revenue })),
      error: res.error,
    };
  }
  return { error: `unknown tool ${name}` };
}

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ToolCallLog = { name: string; input: Record<string, unknown> };
export type ChatResult = { reply: string; toolCalls: ToolCallLog[] };

export async function runChat(history: ChatMessage[]): Promise<ChatResult> {
  const client = new Anthropic();
  const { aiModel } = await getSettings();
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  const toolCalls: ToolCallLog[] = [];

  for (let step = 0; step < 6; step++) {
    const res = await client.messages.create({
      model: aiModel,
      max_tokens: 4096,
      system: SYSTEM,
      tools,
      messages,
    });

    if (res.stop_reason === "refusal") {
      return { reply: "I can't answer this request.", toolCalls };
    }

    if (res.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type === "tool_use") {
          const input = (block.input ?? {}) as Record<string, unknown>;
          toolCalls.push({ name: block.name, input });
          const out = await runTool(block.name, input);
          results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    // end_turn
    const reply = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { reply: reply || "(empty answer)", toolCalls };
  }

  return { reply: "Too many steps, try making the question more specific.", toolCalls };
}

// ---------- Demo without an Anthropic key ----------
// Without ANTHROPIC_API_KEY we answer from a template, but with real numbers from the metrics layer
// (the same get_metrics / get_channels tools), so you can see how the agent works.
function iso(d: Date): string { return d.toISOString().slice(0, 10); }

const NL = "\n";
const money = (v: number) => "$" + Math.round(v).toLocaleString("en-US");

export async function runDemoChat(history: ChatMessage[]): Promise<ChatResult> {
  const q = (history[history.length - 1]?.content ?? "").toLowerCase();
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  const country = /uzbek|\buz\b/.test(q) ? "UZ" : /kyrgyz|\bkg\b/.test(q) ? "KG" : /tajik|\btj\b/.test(q) ? "TJ" : /mongol|\bmn\b/.test(q) ? "MN" : /all countries/.test(q) ? "all" : "KZ";
  const period = { from: iso(from), to: iso(to), country };
  const note = NL + NL + "Demo answer without AI: ANTHROPIC_API_KEY is not set. The numbers come from the metrics layer over demo data.";

  if (/channel|storefront|marketplace/.test(q)) {
    const input = { ...period };
    const out = (await runTool("get_channels", input)) as { channels?: { channel: string; orders: number; buyers: number; revenue: number }[] };
    const rows = out.channels ?? [];
    const total = rows.reduce((s, r) => s + r.revenue, 0) || 1;
    const lines = rows.map((r) => `• ${r.channel}: ${money(r.revenue)} (${((r.revenue / total) * 100).toFixed(1)}%), ${r.orders.toLocaleString("en-US")} orders`);
    return {
      reply: `Slice: ${period.from}..${period.to}, country ${country}.` + NL + NL + lines.join(NL) + NL + NL +
        `The top revenue channel is ${rows[0]?.channel ?? "?"}.` + note,
      toolCalls: [{ name: "get_channels", input }],
    };
  }

  const input = { ...period };
  const out = (await runTool("get_metrics", input)) as { metrics?: { metric: string; value: string; delta: number | null }[] };
  const lines = (out.metrics ?? []).map((m) =>
    `• ${m.metric}: ${m.value}` + (m.delta == null ? "" : ` (${m.delta > 0 ? "+" : ""}${m.delta.toFixed(1)}% vs previous period)`));
  return {
    reply: `Slice: last 30 days (${period.from}..${period.to}), country ${country}, all channels.` + NL + NL + lines.join(NL) + note,
    toolCalls: [{ name: "get_metrics", input }],
  };
}
