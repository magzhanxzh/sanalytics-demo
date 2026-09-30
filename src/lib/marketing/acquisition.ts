import "server-only";
import { listAccounts } from "@/lib/connectors/accounts";
import { getSpendRows } from "@/lib/connectors/spend";
import { cacheGet, cacheSet, isFresh } from "@/lib/cache";
import { queryAcquisition, dayOf } from "@/lib/demo/warehouse";
import { AD_SOURCES } from "@/lib/demo/dims";
import type { CardFilters } from "@/lib/queries/cards";

// "Acquisition channels" for Marketing. Spend comes from connected ad accounts for the period;
// the period's orders and revenue are split by the ad source the user came from
// (MMP attribution is stored on the user). This keeps table volumes comparable
// to the KPI cards: they are the same period orders, just labelled by channel.
// Only channels with spend are shown, i.e. with a connected ad account.

export type AcqChannel = { name: string; spend: number; revenue: number; orders: number; buyers: number; cac: number; roas: number };
export type AcqResult = {
  connected: boolean;              // whether at least one ad account is enabled
  channels: AcqChannel[];
  totalSpend: number; totalRevenue: number; roas: number;
  paidOrdersShare?: number;        // share of period orders from paid channels, %
  note?: string;
};

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function getAcquisitionChannels(f: CardFilters): Promise<AcqResult> {
  const accounts = await listAccounts();
  if (!accounts.some((a) => a.enabled)) {
    return { connected: false, channels: [], totalSpend: 0, totalRevenue: 0, roas: 0 };
  }

  const to = f.to || iso(new Date());
  const from = f.from || iso(new Date(Date.parse(to) - 29 * DAY_MS));
  const key = "acq:" + JSON.stringify({ from, to, c: f.country, oc: f.orderCreator, uc: f.userCreator, b: f.basis, b2b: f.excludeB2b, acc: accounts.filter((a) => a.enabled).map((a) => a.id) });
  const hit = cacheGet<AcqResult>(key);
  if (hit && isFresh(hit.at)) return hit.data;

  const { rows, total } = queryAcquisition(
    { from: dayOf(from), toExcl: dayOf(to) + 1, orderChannel: f.orderCreator, excludeB2b: f.excludeB2b },
    { country: f.country, userChannel: f.userCreator },
  );
  const isAll = !f.country || f.country === "all";
  const spendBy = new Map<string, number>();
  for (const r of await getSpendRows(from, to)) {
    if (!isAll && r.country !== f.country) continue;
    spendBy.set(r.channel, (spendBy.get(r.channel) ?? 0) + r.spend);
  }

  const paid = f.basis === "paid";
  const channels: AcqChannel[] = rows
    .map((r) => {
      const name = AD_SOURCES[r.source];
      const spend = spendBy.get(name) ?? 0;
      const revenue = paid ? r.revenuePaid : r.revenue;
      return { name, spend, revenue, orders: r.orders, buyers: r.buyers, cac: r.buyers ? spend / r.buyers : 0, roas: spend ? revenue / spend : 0 };
    })
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend);

  const totalSpend = channels.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);
  const paidOrders = channels.reduce((s, c) => s + c.orders, 0);
  const data: AcqResult = {
    connected: true, channels, totalSpend, totalRevenue,
    roas: totalSpend ? totalRevenue / totalSpend : 0,
    paidOrdersShare: total.orders ? (paidOrders / total.orders) * 100 : 0,
    note: channels.length ? undefined : "No spend in this period: connect an ad account in Integrations or widen the period",
  };
  cacheSet(key, data);
  return data;
}
