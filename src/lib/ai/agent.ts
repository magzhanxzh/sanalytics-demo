import Anthropic from "@anthropic-ai/sdk";
import { getCards, getChannels } from "@/lib/metrics";
import { defaultFilters, type CardFilters } from "@/lib/queries/cards";
import { getSettings } from "@/lib/settings/store";
import { enforceCountry } from "@/lib/auth/access";

const SYSTEM = `Ты ИИ-аналитик витрины Sanalytics (e-commerce магазин с доставкой, рынки KZ/UZ/KG/TJ/MN).
Отвечаешь на вопросы руководителя и маркетолога по РЕАЛЬНЫМ данным, которые получаешь только через инструменты.

Модель данных:
- «Канал заказа» (order channel) – витрина, через которую сделан заказ: store, marketplace_a, marketplace_b, express.
- «Канал клиента» (user channel) – где пользователь зарегистрировался: app, web, partner.
- Страна – страна пользователя (KZ Казахстан, UZ, KG, TJ, MN).
- Метрики: регистрации, покупатели (сделали заказ), заказы, средний чек, вес (кг), выручка. Валюта – $.
- «Конверсия» = покупатели / регистрации, и она имеет смысл ТОЛЬКО с периодом регистрации (когортой): тогда покупатели входят в когорту. Без когорты не считай конверсию.
- Выручка: gross (валовая, sum цены) или paid (оплаченная). По умолчанию gross.
- B2B: корпоративные аккаунты (>50 заказов/мес) можно исключать.

Правила:
- Основывай ответы ТОЛЬКО на числах из инструментов. НИКОГДА не выдумывай цифры.
- Всегда указывай, какой срез использовал (период, страна, каналы).
- Отвечай на русском, кратко и по делу, без длинного тире.
- Это демо-стенд: данные синтетические, но считаются тем же слоем метрик, что и в продакшене.
- Если период не задан – уточни или возьми разумный (например последние 30 дней) и скажи об этом.
- Для вопросов «какой канал лучше/больше» используй get_channels.
- Для сравнений (месяц к месяцу, канал vs канал) вызывай инструмент несколько раз.
- Ты read-only: ничего не меняешь и не пишешь в базы.`;

const tools: Anthropic.Tool[] = [
  {
    name: "get_metrics",
    description:
      "Ключевые метрики за период по срезу: регистрации, покупатели, конверсия (только с когортой), заказы, средний чек, вес, выручка.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "начало периода заказа YYYY-MM-DD" },
        to: { type: "string", description: "конец периода заказа YYYY-MM-DD (включительно)" },
        country: { type: "string", enum: ["KZ", "UZ", "KG", "TJ", "MN", "all"], description: "страна пользователя" },
        orderCreator: { type: "string", description: "канал заказа или 'all'" },
        userCreator: { type: "string", description: "канал регистрации или 'all'" },
        basis: { type: "string", enum: ["gross", "paid"], description: "выручка валовая/оплаченная" },
        excludeB2b: { type: "boolean", description: "исключать корпоративные аккаунты" },
        regFrom: { type: "string", description: "период регистрации (когорта) с YYYY-MM-DD, опционально" },
        regTo: { type: "string", description: "период регистрации (когорта) по YYYY-MM-DD, опционально" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "get_channels",
    description: "Разбивка по каналам заказа за период: заказы, покупатели, выручка. Для вопросов какой канал лучше/больше.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "начало периода YYYY-MM-DD" },
        to: { type: "string", description: "конец периода YYYY-MM-DD (включительно)" },
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
      срез: { период: `${f.from}..${f.to}`, страна: f.country, каналЗаказа: f.orderCreator, каналКлиента: f.userCreator, когорта: f.regFrom ? `${f.regFrom}..${f.regTo}` : null, выручка: f.basis, безB2B: f.excludeB2b },
      метрики: res.cards.map((c) => ({ показатель: c.title, значение: c.value, дельта: c.deltaPct })),
      error: res.error,
    };
  }
  if (name === "get_channels") {
    const f = buildFilters(input);
    f.country = await enforceCountry(f.country);
    const res = await getChannels(f);
    return {
      срез: { период: `${f.from}..${f.to}`, страна: f.country, выручка: f.basis },
      каналы: res.channels.map((c) => ({ канал: c.channel, заказы: c.orders, покупатели: c.buyers, выручка: c.revenue })),
      error: res.error,
    };
  }
  return { error: `неизвестный инструмент ${name}` };
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
      return { reply: "Не могу ответить на этот запрос.", toolCalls };
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
    return { reply: reply || "(пустой ответ)", toolCalls };
  }

  return { reply: "Слишком много шагов, попробуйте уточнить вопрос.", toolCalls };
}

// ---------- Демо без ключа Anthropic ----------
// Без ANTHROPIC_API_KEY отвечаем шаблоном, но по настоящим числам из слоя метрик
// (те же инструменты get_metrics / get_channels), чтобы было видно, как агент работает.
function iso(d: Date): string { return d.toISOString().slice(0, 10); }

const NL = "\n";
const money = (v: number) => "$" + Math.round(v).toLocaleString("ru-RU");

export async function runDemoChat(history: ChatMessage[]): Promise<ChatResult> {
  const q = (history[history.length - 1]?.content ?? "").toLowerCase();
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  const country = /узбек|\buz\b/.test(q) ? "UZ" : /кыргыз|\bkg\b/.test(q) ? "KG" : /все стран/.test(q) ? "all" : "KZ";
  const period = { from: iso(from), to: iso(to), country };
  const note = NL + NL + "Демо-ответ без ИИ: ключ ANTHROPIC_API_KEY не задан. Цифры посчитаны слоем метрик по демо-данным.";

  if (/канал|channel|витрин/.test(q)) {
    const input = { ...period };
    const out = (await runTool("get_channels", input)) as { каналы?: { канал: string; заказы: number; покупатели: number; выручка: number }[] };
    const rows = out.каналы ?? [];
    const total = rows.reduce((s, r) => s + r.выручка, 0) || 1;
    const lines = rows.map((r) => `• ${r.канал}: ${money(r.выручка)} (${((r.выручка / total) * 100).toFixed(1)}%), заказов ${r.заказы.toLocaleString("ru-RU")}`);
    return {
      reply: `Срез: ${period.from}..${period.to}, страна ${country}.` + NL + NL + lines.join(NL) + NL + NL +
        `Больше всего выручки дал канал ${rows[0]?.канал ?? "?"}.` + note,
      toolCalls: [{ name: "get_channels", input }],
    };
  }

  const input = { ...period };
  const out = (await runTool("get_metrics", input)) as { метрики?: { показатель: string; значение: string; дельта: number | null }[] };
  const lines = (out.метрики ?? []).map((m) =>
    `• ${m.показатель}: ${m.значение}` + (m.дельта == null ? "" : ` (${m.дельта > 0 ? "+" : ""}${m.дельта.toFixed(1)}% к прошлому периоду)`));
  return {
    reply: `Срез: последние 30 дней (${period.from}..${period.to}), страна ${country}, все каналы.` + NL + NL + lines.join(NL) + note,
    toolCalls: [{ name: "get_metrics", input }],
  };
}
