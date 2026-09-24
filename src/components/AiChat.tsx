"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
type ToolCall = { name: string; input: Record<string, unknown> };

const STARTERS = [
  "Выручка за последние 30 дней по Казахстану",
  "Какой канал заказа дал больше всего выручки за прошлый месяц?",
  "Метрики по Узбекистану за 30 дней",
];

function Role({ children }: { children: string }) {
  return (
    <div className="mono text-muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
      {children}
    </div>
  );
}

export function AiChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setHistory((h) => [q, ...h.filter((x) => x !== q)].slice(0, 12));
    setLoading(true);
    setTimeout(() => listRef.current?.scrollTo(0, listRef.current.scrollHeight), 50);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "(нет ответа)" }]);
      setToolCalls(Array.isArray(data.toolCalls) ? data.toolCalls : []);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Ошибка сети. Попробуйте ещё раз." }]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollTo(0, listRef.current.scrollHeight), 50);
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "start" }}>
      {/* Чат */}
      <div className="border border-line bg-surface rounded-xl flex flex-col" style={{ minHeight: 560 }}>
        <div ref={listRef} className="flex-1 flex flex-col gap-5 overflow-y-auto" style={{ padding: 22, maxHeight: 560 }}>
          {messages.length === 0 && (
            <div className="text-muted" style={{ fontSize: 13.5 }}>
              Спросите про выручку, каналы, когорты, конверсию. Примеры ниже.
              <div className="flex flex-col gap-2" style={{ marginTop: 14 }}>
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-left bg-sunk hover:border-accent border border-transparent transition-colors" style={{ borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i}>
              <Role>{m.role === "user" ? "Вы" : "ИИ-аналитик"}</Role>
              {m.role === "user" ? (
                <span className="inline-block bg-sunk border border-line" style={{ borderRadius: 10, padding: "12px 14px", fontSize: 14, lineHeight: 1.55 }}>
                  {m.content}
                </span>
              ) : (
                <p className="text-ink-2" style={{ fontSize: 14, lineHeight: 1.65, maxWidth: "68ch", whiteSpace: "pre-wrap" }}>
                  {m.content}
                </p>
              )}
            </div>
          ))}
          {loading && (
            <div>
              <Role>ИИ-аналитик</Role>
              <p className="text-muted" style={{ fontSize: 14 }}>Считаю по данным…</p>
            </div>
          )}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-3 border-t border-line"
          style={{ padding: "14px 18px" }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Спросите о выручке, каналах, когортах…"
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 13.5 }}
          />
          <button type="submit" disabled={loading} className="text-[color:var(--accent-ink)] disabled:opacity-60" style={{ background: "var(--accent)", borderRadius: 7, padding: "8px 14px", fontSize: 12.5, fontWeight: 500 }}>
            Отправить
          </button>
        </form>
      </div>

      {/* Контекст + история */}
      <div className="flex flex-col gap-4">
        <div className="border border-line bg-surface rounded-xl" style={{ padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>Контекст ответа</div>
          {toolCalls.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 12.5 }}>Здесь появятся запросы к данным, на которых построен ответ.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {toolCalls.map((t, i) => (
                <div key={i} style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                  <div className="mono" style={{ fontSize: 11.5, color: "var(--accent)" }}>{t.name}</div>
                  <div className="mono text-muted" style={{ fontSize: 11, marginTop: 2, wordBreak: "break-word" }}>
                    {Object.entries(t.input).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${v}`).join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border border-line bg-surface rounded-xl" style={{ padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>История</div>
          {history.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 12.5 }}>Ваши прошлые вопросы появятся здесь.</p>
          ) : (
            history.map((h, i) => (
              <button key={i} onClick={() => send(h)} className="block text-left text-ink-2 hover:text-ink w-full" style={{ fontSize: 12.5, padding: "6px 0" }}>
                {h}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
