// ─────────────────────────────────────────────────────────────
//  telegram-notify · sends an instant Telegram message on each
//  paid order, decrements product stock, and reports remaining qty.
//
//  Invoked from the kiosk after an order is inserted:
//    supabase.functions.invoke("telegram-notify", { body: { order_id } })
//
//  Secrets (Edge Function → Settings → Secrets):
//    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
//  (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// ─────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN   = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const URL     = Deno.env.get("SUPABASE_URL")!;
const KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmt = (n: number) => Number(n || 0).toLocaleString("ru-RU");

async function sendMessage(chatId: string | number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) console.error("telegram error", await res.text());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { order_id } = await req.json();
    const supabase = createClient(URL, KEY);

    const { data: order } = await supabase.from("orders").select("*").eq("id", order_id).single();
    if (!order) return new Response(JSON.stringify({ error: "order not found" }), { status: 404, headers: cors });

    let locName = "";
    if (order.location_id) {
      const { data: loc } = await supabase.from("locations").select("name").eq("id", order.location_id).single();
      locName = loc?.name || "";
    }

    const items = Array.isArray(order.items) ? order.items : [];

    // Decrement stock for each purchased product and collect remaining qty
    const remaining: { name: string; qty: number }[] = [];
    for (const it of items) {
      if (!it.id) continue;
      const { data: prod } = await supabase.from("products").select("quantity, name").eq("id", it.id).single();
      if (!prod) continue;
      const newQty = Math.max(0, (prod.quantity ?? 0) - (it.qty ?? 1));
      await supabase.from("products").update({ quantity: newQty }).eq("id", it.id);
      remaining.push({ name: prod.name, qty: newQty });
    }

    const when = new Date(order.created_at);
    const time = when.toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });
    const date = when.toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", year: "numeric" });

    const lines: string[] = [];
    lines.push(`🛒 <b>Новый заказ</b>${locName ? " — " + locName : ""}`);
    lines.push(`🕐 ${time} | ${date}`);
    lines.push("");
    lines.push("📦 <b>Состав:</b>");
    for (const it of items) lines.push(`- ${it.name} × ${it.qty} = ${fmt((it.price || 0) * (it.qty || 1))} сум`);
    lines.push("");
    lines.push(`💰 <b>Итого: ${fmt(order.total)} сум</b>`);
    if (remaining.length) {
      lines.push("📊 Остаток товаров:");
      for (const r of remaining) lines.push(`- ${r.name} — осталось ${r.qty} шт`);
    }

    await sendMessage(CHAT_ID, lines.join("\n"));
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
