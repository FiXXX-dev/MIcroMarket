// ─────────────────────────────────────────────────────────────
//  telegram-report · Telegram webhook.
//  Shows a button keyboard (/start) and answers:
//    «📊 Отчёт за сегодня» — today's sales summary
//    «📦 Остатки»          — current stock list
//  (Both also work as /report and /stock commands.)
//
//  Set the webhook once (replace <TOKEN> and <PROJECT>):
//    curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<PROJECT>.supabase.co/functions/v1/telegram-report"
//  Deploy with --no-verify-jwt (Telegram sends no auth header).
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

// Persistent button keyboard shown under the message box
const KEYBOARD = {
  reply_markup: {
    keyboard: [["📊 Отчёт за сегодня"], ["📦 Остатки"]],
    resize_keyboard: true,
    is_persistent: true,
  },
};

function supa() { return createClient(URL, KEY); }

async function sendMessage(chatId: string | number, text: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  });
  if (!res.ok) console.error("telegram error", await res.text());
}

// Start of "today" in Asia/Tashkent, expressed as a UTC Date
function startOfTodayUtc(): Date {
  const shifted = new Date(Date.now() + TZ_OFFSET_MS);
  const y = shifted.getUTCFullYear(), m = shifted.getUTCMonth(), d = shifted.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0) - TZ_OFFSET_MS);
}

async function buildReport(): Promise<string> {
  const supabase = supa();
  const since = startOfTodayUtc();

  const { data: orders } = await supabase
    .from("orders").select("*")
    .eq("status", "paid")
    .gte("created_at", since.toISOString());

  const paid = orders || [];
  const revenue = paid.reduce((s, o) => s + (o.total || 0), 0);

  const tally = new Map<string, number>();
  for (const o of paid) {
    const items = Array.isArray(o.items) ? o.items : [];
    for (const it of items) tally.set(it.name, (tally.get(it.name) || 0) + (it.qty || 1));
  }
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const { data: lowStock } = await supabase
    .from("products").select("name, quantity")
    .lt("quantity", 5).order("quantity", { ascending: true });

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
  return lines.join("\n");
}

async function buildStock(): Promise<string> {
  const supabase = supa();
  const { data: products } = await supabase
    .from("products").select("name, quantity, category")
    .order("quantity", { ascending: true });

  const list = products || [];
  const lines: string[] = [];
  lines.push("📦 <b>Остатки товаров</b>");
  lines.push("");
  if (!list.length) {
    lines.push("Товаров пока нет.");
  } else {
    for (const p of list) {
      const warn = p.quantity <= 0 ? "❌" : p.quantity < 5 ? "⚠️" : "✅";
      const tail = p.quantity <= 0 ? "нет в наличии" : `${p.quantity} шт`;
      lines.push(`${warn} ${p.name} — ${tail}`);
    }
  }
  return lines.join("\n");
}

Deno.serve(async (req) => {
  try {
    const update = await req.json();
    const msg = update.message || update.edited_message;
    const text: string = (msg?.text || "").trim();
    const chatId = msg?.chat?.id;
    if (!chatId) return new Response("ok");

    const low = text.toLowerCase();
    const isReport = low.startsWith("/report") || text.includes("Отчёт");
    const isStock  = low.startsWith("/stock")  || text.includes("Остатки");
    const isStart  = low.startsWith("/start")  || low.startsWith("/menu");

    if (isReport) {
      await sendMessage(chatId, await buildReport(), KEYBOARD);
    } else if (isStock) {
      await sendMessage(chatId, await buildStock(), KEYBOARD);
    } else if (isStart) {
      await sendMessage(chatId, "🏪 <b>МикроМаркет</b>\nВыберите действие кнопкой ниже 👇", KEYBOARD);
    } else {
      // any other text — show the keyboard so buttons are always available
      await sendMessage(chatId, "Выберите действие:", KEYBOARD);
    }
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("ok"); // always 200 so Telegram doesn't retry-storm
  }
});
