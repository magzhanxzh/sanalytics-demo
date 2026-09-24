import { NextResponse } from "next/server";
import { runChat, runDemoChat, type ChatMessage } from "@/lib/ai/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_json", reply: "Некорректный запрос.", toolCalls: [] }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "empty", reply: "Пустой запрос.", toolCalls: [] }, { status: 400 });
  }

  // Без ключа: демо-ответ по настоящим числам слоя метрик.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(await runDemoChat(messages));
  }

  try {
    const result = await runChat(messages);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "ai_error", reply: "Ошибка при обращении к ИИ: " + String(err), toolCalls: [] },
      { status: 200 },
    );
  }
}
