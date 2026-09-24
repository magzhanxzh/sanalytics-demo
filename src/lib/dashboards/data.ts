import "server-only";
import { getCards, getDaily, getChannels, getByCountry, getReactivation, getReactivationByCountry } from "@/lib/metrics";
import { COUNTRIES, type CardFilters, type DailyPoint } from "@/lib/queries/cards";
import type { Widget, WidgetData, Metric } from "./types";

function toFilters(w: Widget): CardFilters {
  const grain = w.breakdown === "week" ? "week" : w.breakdown === "month" ? "month" : "day";
  return { ...w.filters, grain };
}

function pointValue(metric: Metric, p: DailyPoint): number {
  switch (metric) {
    case "revenue": return p.revenue;
    case "orders": return p.orders;
    case "buyers": return p.buyers;
    case "weight": return p.weight;
    case "registrations": return p.registrations;
    case "avg_check": return p.orders ? p.revenue / p.orders : 0;
    case "conversion": return p.registrations ? (p.buyers / p.registrations) * 100 : 0;
    case "reactivation": return 0; // считается отдельной веткой (getReactivation)
    default: return 0; // на случай устаревшей метрики в сохранённом виджете (напр. старый ltv)
  }
}

function rowValue(metric: Metric, r: { orders: number; buyers: number; revenue: number }): number | null {
  switch (metric) {
    case "revenue": return r.revenue;
    case "orders": return r.orders;
    case "buyers": return r.buyers;
    case "avg_check": return r.orders ? r.revenue / r.orders : 0;
    default: return null; // weight/registrations/conversion недоступны в разбивке по каналам/странам
  }
}

const countryLabel = (code: string) => COUNTRIES.find((c) => c.code === code)?.label ?? code;

// Гео-фильтр для разбивок по странам: null – без ограничений (owner/admin/прогрев),
// иначе оставляем только строки из разрешённых пользователю стран.
function keepCountry<T extends { country: string }>(rows: T[], allowed: string[] | null): T[] {
  if (!allowed) return rows;
  const set = new Set(allowed);
  return rows.filter((r) => set.has(r.country));
}

export async function resolveWidget(w: Widget, allowed: string[] | null = null): Promise<WidgetData> {
  const f = toFilters(w);

  try {
    // Реактивация – отдельная ветка (метрика со «спячкой»). Поддержка: KPI/таблица (общее число)
    // и разбивка по странам. По дням/каналам не считаем (период-определение).
    if (w.metric === "reactivation") {
      const dorm = w.filters.dormancyDays ?? 180;
      if (w.breakdown === "country") {
        const res = await getReactivationByCountry(f, dorm);
        if (res.error) return { kind: "error", message: "Ошибка данных" };
        const countries = keepCountry(res.countries, allowed);
        const items = countries.map((c) => ({ label: countryLabel(c.country), value: c.react })).filter((p) => p.value > 0).slice(0, 12);
        if (w.type === "table") {
          return { kind: "table", columns: ["Страна", "Реактивировано", "Первый заказ", "Повторный", "Покупатели"], rows: countries.map((c) => [countryLabel(c.country), c.react, c.reactFirst, c.reactRepeat, c.buyers]) };
        }
        if (items.length === 0) return { kind: "error", message: "Нет реактивированных за период" };
        return { kind: "points", points: items };
      }
      // none / kpi / прочее -> общее число реактивированных
      const res = await getReactivation(f, dorm);
      if (res.error) return { kind: "error", message: "Ошибка данных" };
      if (w.type === "table") {
        return { kind: "table", columns: ["Показатель", "Значение"], rows: [
          [`Реактивировано (спячка ≥ ${dorm} дн.)`, res.react.toLocaleString("ru-RU")],
          ["Из них с первым заказом", res.reactFirst.toLocaleString("ru-RU")],
          ["Из них повторных", res.reactRepeat.toLocaleString("ru-RU")],
          ["Доля первых заказов", (res.react ? (res.reactFirst / res.react) * 100 : 0).toFixed(1) + "%"],
          ["Покупателей за период", res.buyers.toLocaleString("ru-RU")],
          ["Доля реактивации", (res.buyers ? (res.react / res.buyers) * 100 : 0).toFixed(1) + "%"],
        ] };
      }
      return { kind: "value", value: res.react };
    }

    // KPI – одно число
    if (w.type === "kpi") {
      const res = await getCards(f);
      if (res.error) return { kind: "error", message: "Ошибка данных" };
      const raw = res.raw;
      if (!raw) return { kind: "error", message: "Нет данных" };
      const v = pointValue(w.metric, {
        date: "", revenue: raw.revenue, orders: raw.orders, buyers: raw.buyers, weight: raw.weight, registrations: raw.registrations,
      });
      return { kind: "value", value: v };
    }

    // Таблица
    if (w.type === "table") {
      if (w.breakdown === "channel" || w.breakdown === "country") {
        const rows = w.breakdown === "channel"
          ? (await getChannels(f)).channels.map((c) => [c.channel, c.orders, c.buyers, Math.round(c.revenue)])
          : keepCountry((await getByCountry(f)).countries, allowed).map((c) => [countryLabel(c.country), c.orders, c.buyers, Math.round(c.revenue)]);
        return { kind: "table", columns: [w.breakdown === "channel" ? "Канал" : "Страна", "Заказы", "Покупатели", "Выручка"], rows };
      }
      if (w.breakdown === "none") {
        const res = await getCards(f);
        return { kind: "table", columns: ["Показатель", "Значение"], rows: res.cards.map((c) => [c.title, c.value]) };
      }
      // разбивка по времени
      const daily = await getDaily(f);
      return { kind: "table", columns: ["Период", "Значение"], rows: daily.points.map((p) => [p.date, Math.round(pointValue(w.metric, p) * 100) / 100]) };
    }

    // Разбивка по каналам/странам (bar/pie)
    if (w.breakdown === "channel" || w.breakdown === "country") {
      const items = w.breakdown === "channel"
        ? (await getChannels(f)).channels.map((c) => ({ label: c.channel, ...c }))
        : keepCountry((await getByCountry(f)).countries, allowed).map((c) => ({ label: countryLabel(c.country), ...c }));
      const points = items
        .map((it) => ({ label: it.label, value: rowValue(w.metric, it) }))
        .filter((p): p is { label: string; value: number } => p.value !== null)
        .slice(0, 12);
      if (points.length === 0) return { kind: "error", message: "Метрика недоступна в этой разбивке" };
      return { kind: "points", points };
    }

    // Временной ряд (line/area/bar по времени)
    const daily = await getDaily(f);
    if (daily.error) return { kind: "error", message: "Ошибка данных" };
    return { kind: "points", points: daily.points.map((p) => ({ label: p.date, value: pointValue(w.metric, p) })) };
  } catch (err) {
    return { kind: "error", message: String(err).slice(0, 120) };
  }
}
