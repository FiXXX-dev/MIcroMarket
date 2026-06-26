// ─────────────────────────────────────────────────────────────
//  telegram-report · Telegram webhook with per-location selection
//  and day / week / month periods.
//
//  Reply keyboard: «📊 Сегодня» «📈 Неделя» «🗓 Месяц» / «📦 Остатки»
//  → bot shows inline buttons with the list of points (+ «Все точки»)
//  → tap a point to get its report / stock.
//
//  Webhook (replace <TOKEN> / <PROJECT>):
//    curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<PROJECT>.supabase.co/functions/v1/telegram-report"
//  Deploy with --no-verify-jwt.
//
//  Secrets: TELEGRAM_BOT_TOKEN (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY auto-injected)
// ─────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const URL   = Deno.env.get("SUPABASE_URL")!;
const KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TZ = "Asia/Tashkent";
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5, no DST

type Period = "today" | "week" | "month";
const PERIOD_LABEL: Record<Period, string> = { today: "сегодня", week: "неделю", month: "месяц" };

const fmt = (n: number) => Number(n || 0).toLocaleString("ru-RU");

const KEYBOARD = {
  reply_markup: {
    keyboard: [["📊 Сегодня", "📈 Неделя", "🗓 Месяц"], ["📦 Остатки"]],
    resize_keyboard: true,
    is_persistent: true,
  },
};

function supa() { return createClient(URL, KEY); }

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("telegram error", method, await res.text());
}

const sendMessage = (chatId: string | number, text: string, extra: Record<string, unknown> = {}) =>
  tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });

// Start of the given period in Asia/Tashkent, expressed as a UTC Date
function periodStartUtc(period: Period): Date {
  const shifted = new Date(Date.now() + TZ_OFFSET_MS);
  const y = shifted.getUTCFullYear(), m = shifted.getUTCMonth(), d = shifted.getUTCDate();
  if (period === "month") return new Date(Date.UTC(y, m, 1, 0, 0, 0) - TZ_OFFSET_MS);
  if (period === "week") {
    const dow = shifted.getUTCDay();           // 0=Sun..6=Sat
    const diff = dow === 0 ? 6 : dow - 1;        // days back to Monday
    return new Date(Date.UTC(y, m, d - diff, 0, 0, 0) - TZ_OFFSET_MS);
  }
  return new Date(Date.UTC(y, m, d, 0, 0, 0) - TZ_OFFSET_MS); // today
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const todayStr = () => fmtDate(new Date());

function dateLine(period: Period, since: Date): string {
  return period === "today" ? `📅 ${todayStr()}` : `📅 ${fmtDate(since)} — ${todayStr()}`;
}

async function getLocations() {
  const { data } = await supa().from("locations").select("id, name").order("created_at");
  return data || [];
}

// Inline keyboard: one button per point + «Все точки». Period is carried in callback_data.
async function locationKeyboard(prefix: "report" | "stock", period?: Period) {
  const locs = await getLocations();
  const suffix = period ? `:${period}` : "";
  const rows = locs.map((l) => [{ text: `📍 ${l.name}`, callback_data: `${prefix}:${l.id}${suffix}` }]);
  rows.push([{ text: "🌐 Все точки", callback_data: `${prefix}:all${suffix}` }]);
  return { reply_markup: { inline_keyboard: rows } };
}

// ── REPORT ──────────────────────────────────────────────────
async function reportForLocation(locationId: string, period: Period): Promise<string> {
  const supabase = supa();
  const since = periodStartUtc(period);

  const { data: loc } = await supabase.from("locations").select("name").eq("id", locationId).single();
  const { data: orders } = await supabase.from("orders").select("*")
    .eq("status", "paid").eq("location_id", locationId).gte("created_at", since.toISOString());

  const paid = orders || [];
  const revenue = paid.reduce((s, o) => s + (o.total || 0), 0);

  const tally = new Map<string, number>();
  for (const o of paid) for (const it of (Array.isArray(o.items) ? o.items : [])) {
    tally.set(it.name, (tally.get(it.name) || 0) + (it.qty || 1));
  }
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const { data: lowStock } = await supabase.from("products").select("name, quantity")
    .eq("location_id", locationId).lt("quantity", 5).order("quantity", { ascending: true });

  const lines: string[] = [];
  lines.push(`📊 <b>Отчёт за ${PERIOD_LABEL[period]}</b> — ${loc?.name || "точка"}`);
  lines.push(dateLine(period, since));
  lines.push("");
  lines.push(`💰 Выручка: <b>${fmt(revenue)} сум</b>`);
  lines.push(`🛒 Заказов: <b>${paid.length}</b>`);
  if (top.length) {
    lines.push("");
    lines.push("🏆 <b>Топ товары:</b>");
    top.forEach(([name, qty], i) => lines.push(`${i + 1}. ${name} — ${qty} шт`));
  }
  if (lowStock && lowStock.length) {
    lines.push("");
    lines.push("📦 <b>Низкий остаток (менее 5 шт):</b>");
    for (const p of lowStock) lines.push(`⚠️ ${p.name} — ${p.quantity} шт`);
  }
  return lines.join("\n");
}

async function reportAll(period: Period): Promise<string> {
  const supabase = supa();
  const since = periodStartUtc(period);

  const locs = await getLocations();
  const nameById = new Map(locs.map((l) => [l.id, l.name]));

  const { data: orders } = await supabase.from("orders").select("*")
    .eq("status", "paid").gte("created_at", since.toISOString());
  const paid = orders || [];

  const byLoc = new Map<string, { revenue: number; count: number }>();
  const tally = new Map<string, number>();
  let grandRevenue = 0;
  for (const o of paid) {
    grandRevenue += o.total || 0;
    const key = o.location_id || "—";
    const acc = byLoc.get(key) || { revenue: 0, count: 0 };
    acc.revenue += o.total || 0; acc.count += 1;
    byLoc.set(key, acc);
    for (const it of (Array.isArray(o.items) ? o.items : [])) {
      tally.set(it.name, (tally.get(it.name) || 0) + (it.qty || 1));
    }
  }
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const lines: string[] = [];
  lines.push(`📊 <b>Отчёт за ${PERIOD_LABEL[period]}</b> — Все точки`);
  lines.push(dateLine(period, since));
  lines.push("");
  const keys = new Set<string>([...byLoc.keys(), ...locs.map((l) => l.id)]);
  for (const key of keys) {
    const acc = byLoc.get(key) || { revenue: 0, count: 0 };
    const name = nameById.get(key) || "Без точки";
    lines.push(`📍 <b>${name}</b>`);
    lines.push(`   💰 ${fmt(acc.revenue)} сум · 🛒 ${acc.count}`);
  }
  lines.push("");
  lines.push("━━━━━━━━━━━━");
  lines.push(`💰 <b>Итого: ${fmt(grandRevenue)} сум</b> · 🛒 ${paid.length} заказов`);
  if (top.length) {
    lines.push("");
    lines.push("🏆 <b>Топ товары (все точки):</b>");
    top.forEach(([name, qty], i) => lines.push(`${i + 1}. ${name} — ${qty} шт`));
  }
  return lines.join("\n");
}

// ── STOCK ───────────────────────────────────────────────────
function stockLine(p: { name: string; quantity: number }) {
  const warn = p.quantity <= 0 ? "❌" : p.quantity < 5 ? "⚠️" : "✅";
  const tail = p.quantity <= 0 ? "нет в наличии" : `${p.quantity} шт`;
  return `${warn} ${p.name} — ${tail}`;
}

async function stockForLocation(locationId: string): Promise<string> {
  const supabase = supa();
  const { data: loc } = await supabase.from("locations").select("name").eq("id", locationId).single();
  const { data: products } = await supabase.from("products").select("name, quantity")
    .eq("location_id", locationId).order("quantity", { ascending: true });

  const lines: string[] = [];
  lines.push(`📦 <b>Остатки</b> — ${loc?.name || "точка"}`);
  lines.push("");
  if (!products || !products.length) lines.push("Товаров пока нет.");
  else for (const p of products) lines.push(stockLine(p));
  return lines.join("\n");
}

async function stockAll(): Promise<string> {
  const supabase = supa();
  const locs = await getLocations();
  const { data: products } = await supabase.from("products").select("name, quantity, location_id")
    .order("quantity", { ascending: true });
  const list = products || [];

  const lines: string[] = [];
  lines.push("📦 <b>Остатки — все точки</b>");
  for (const l of locs) {
    const items = list.filter((p) => p.location_id === l.id);
    lines.push("");
    lines.push(`📍 <b>${l.name}</b>`);
    if (!items.length) lines.push("— нет товаров");
    else for (const p of items) lines.push(stockLine(p));
  }
  return lines.join("\n");
}

// ── WEBHOOK ─────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const update = await req.json();

    // Button taps (inline keyboard) arrive as callback_query
    const cq = update.callback_query;
    if (cq) {
      const chatId = cq.message?.chat?.id;
      const data: string = cq.data || "";
      await tg("answerCallbackQuery", { callback_query_id: cq.id });
      if (chatId) {
        const [kind, target, period] = data.split(":");
        if (kind === "report") {
          const p = (period as Period) || "today";
          await sendMessage(chatId, target === "all" ? await reportAll(p) : await reportForLocation(target, p), KEYBOARD);
        } else if (kind === "stock") {
          await sendMessage(chatId, target === "all" ? await stockAll() : await stockForLocation(target), KEYBOARD);
        }
      }
      return new Response("ok");
    }

    const msg = update.message || update.edited_message;
    const text: string = (msg?.text || "").trim();
    const chatId = msg?.chat?.id;
    if (!chatId) return new Response("ok");

    const low = text.toLowerCase();
    let period: Period | null = null;
    if (low.startsWith("/month") || text.includes("Месяц")) period = "month";
    else if (low.startsWith("/week") || text.includes("Неделя")) period = "week";
    else if (low.startsWith("/report") || text.includes("Сегодня") || text.includes("Отчёт")) period = "today";

    const isStock = low.startsWith("/stock") || text.includes("Остатки");
    const isStart = low.startsWith("/start") || low.startsWith("/menu");

    if (period) {
      await sendMessage(chatId, `📊 Отчёт за ${PERIOD_LABEL[period]} — выберите точку:`, await locationKeyboard("report", period));
    } else if (isStock) {
      await sendMessage(chatId, "📦 Выберите точку для остатков:", await locationKeyboard("stock"));
    } else if (isStart) {
      await sendMessage(chatId, "🏪 <b>МикроМаркет</b>\nВыберите действие кнопкой ниже 👇", KEYBOARD);
    } else {
      await sendMessage(chatId, "Выберите действие:", KEYBOARD);
    }
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("ok");
  }
});
