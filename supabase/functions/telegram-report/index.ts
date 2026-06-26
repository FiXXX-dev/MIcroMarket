// ─────────────────────────────────────────────────────────────
//  telegram-report · Telegram webhook. When the owner sends
//  /report, replies with today's sales summary for the location(s).
//
//  Set the webhook once (replace <TOKEN> and <PROJECT>):
//    curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<PROJECT>.supabase.co/functions/v1/telegram-report"
//
//  Deploy with --no-verify-jwt (Telegram sends no auth header):
//    supabase functions deploy telegram-report --no-verify-jwt
//
//  Secrets: TELEGRAM_BOT_TOKEN (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY auto-injected)
// ─────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const URL   = Deno.env.get("SUPABASE_URL")!;
const KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TZ = "Asia/Tashkent";
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5, no DST

const fmt = (n: number) => Number(n || 0).toLocaleString("ru-RU");

async function sendMessage(chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

// Start of "today" in Asia/Tashkent, expressed as a UTC Date
function startOfTodayUtc(): Date {
  const shifted = new Date(Date.now() + TZ_OFFSET_MS);
  const y = shifted.getUTCFullYear(), m = shifted.getUTCMonth(), d = shifted.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0) - TZ_OFFSET_MS);
}

Deno.serve(async (req) => {
  try {
    const update = await req.json();
    const msg = update.message || update.edited_message;
    const text: string = msg?.text || "";
    const chatId = msg?.chat?.id;

    if (!chatId || !text.trim().toLowerCase().startsWith("/report")) {
      return new Response("ok"); // ignore non-command updates
    }

    const supabase = createClient(URL, KEY);
    const since = startOfTodayUtc();

    // Today's paid orders
    const { data: orders } = await supabase
      .from("orders").select("*")
      .eq("status", "paid")
      .gte("created_at", since.toISOString());

    const paid = orders || [];
    const revenue = paid.reduce((s, o) => s + (o.total || 0), 0);

    // Aggregate top products from order items
    const tally = new Map<string, number>();
    for (const o of paid) {
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        tally.set(it.name, (tally.get(it.name) || 0) + (it.qty || 1));
      }
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Low stock (< 5)
    const { data: lowStock } = await supabase
      .from("products").select("name, quantity")
      .lt("quantity", 5)
      .order("quantity", { ascending: true });

    // Location label
    const { data: locs } = await supabase.from("locations").select("name");
    const locLabel = locs && locs.length === 1 ? locs[0].name : "Все точки";

    const date = new Date().toLocaleDateString("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });

    const lines: string[] = [];
    lines.push(`📊 <b>Отчёт за сегодня</b> — ${locLabel}`);
    lines.push(`📅 ${date}`);
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

    await sendMessage(chatId, lines.join("\n"));
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("ok"); // always 200 so Telegram doesn't retry-storm
  }
});
