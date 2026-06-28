import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const IDLE_TIMEOUT_MS = 20000;   // show modal after 20s of inactivity
const IDLE_COUNTDOWN = 15;       // seconds before cart auto-clears

const FALLBACK_PRODUCTS = [
  { id: 1,  name: "Вода Nestle 0.5л",      price: 3000,  emoji: "💧", category: "Напитки" },
  { id: 2,  name: "Coca-Cola 0.5л",         price: 8000,  emoji: "🥤", category: "Напитки", badge: "hit" },
  { id: 3,  name: "Red Bull 0.25л",         price: 15000, emoji: "⚡", category: "Напитки" },
  { id: 4,  name: "Сок Rich яблоко",        price: 7000,  emoji: "🍎", category: "Напитки" },
  { id: 5,  name: "Сникерс",                price: 5000,  emoji: "🍫", category: "Снеки",   badge: "hit" },
  { id: 6,  name: "Чипсы Lays",             price: 9000,  emoji: "🥔", category: "Снеки" },
  { id: 7,  name: "Орехи ассорти",          price: 12000, emoji: "🥜", category: "Снеки" },
  { id: 8,  name: "Протеиновый батончик",   price: 18000, emoji: "💪", category: "Снеки",   badge: "new" },
  { id: 9,  name: "Сэндвич с курицей",      price: 22000, emoji: "🥪", category: "Еда",     badge: "hit" },
  { id: 10, name: "Салат Цезарь",           price: 28000, emoji: "🥗", category: "Еда" },
  { id: 11, name: "Пирожок с мясом",        price: 8000,  emoji: "🥟", category: "Еда" },
  { id: 12, name: "Йогурт Активиа",         price: 9000,  emoji: "🫙", category: "Еда" },
  { id: 13, name: "Американо",              price: 12000, emoji: "☕", category: "Кофе" },
  { id: 14, name: "Капучино",               price: 15000, emoji: "☕", category: "Кофе",    badge: "hit" },
  { id: 15, name: "Чай зелёный",            price: 8000,  emoji: "🍵", category: "Кофе" },
];

const FALLBACK_BANNER = { text: "Свежая еда и напитки — прямо здесь!", emoji: "🔥", color: "#FFE83A" };

const CATEGORIES = ["Все", "Напитки", "Снеки", "Еда", "Кофе"];

const BADGE_MAP = {
  hit:  { emoji: "🔥", label: "Хит",       bg: "#FF2D55", color: "#fff" },
  new:  { emoji: "✨", label: "Новинка",    bg: "#7c3aed", color: "#fff" },
  sale: { emoji: "🏷", label: "Акция",      bg: "#d97706", color: "#fff" },
  last: { emoji: "⚠️", label: "Последний",  bg: "#ca8a04", color: "#1a1a1a" },
};

function formatPrice(p) {
  return p.toLocaleString("ru-RU") + " сум";
}

function QRPattern({ value, size = 180 }) {
  const cells = 21;
  const seed = value.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const grid = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      const inCorner = (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);
      if (inCorner) {
        const edgeR = r === 0 || r === 6 || r === cells - 7 || r === cells - 1;
        const edgeC = c === 0 || c === 6 || c === cells - 7 || c === cells - 1;
        const inner =
          (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
          (r >= 2 && r <= 4 && c >= cells - 5 && c <= cells - 3) ||
          (r >= cells - 5 && r <= cells - 3 && c >= 2 && c <= 4);
        return edgeR || edgeC || inner ? 1 : 0;
      }
      return ((seed * (r + 1) * (c + 1) * 2654435761) >>> 0) % 3 === 0 ? 1 : 0;
    })
  );
  const cs = size / cells;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="white" rx="6" />
      {grid.map((row, r) =>
        row.map((cell, c) =>
          cell ? <rect key={`${r}-${c}`} x={c * cs} y={r * cs} width={cs} height={cs} fill="#1a1a1a" /> : null
        )
      )}
    </svg>
  );
}

export default function KioskApp() {
  const [location, setLocation]   = useState(null);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState(FALLBACK_PRODUCTS);
  const [banner, setBanner] = useState(FALLBACK_BANNER);
  const [cart, setCart] = useState([]);
  const [category, setCategory] = useState("Все");
  const [screen, setScreen] = useState("catalog");
  const [timeLeft, setTimeLeft] = useState(60);
  const [paymentRef] = useState(`KSK-${Date.now().toString(36).toUpperCase()}`);

  // ── Inactivity timeout ──
  const [showIdle, setShowIdle] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(IDLE_COUNTDOWN);
  const [idleNonce, setIdleNonce] = useState(0);
  const idleTimerRef = useRef(null);
  const showIdleRef = useRef(false);
  const lastBumpRef = useRef(0);
  useEffect(() => { showIdleRef.current = showIdle; }, [showIdle]);

  const idleContinue = () => setShowIdle(false);
  const idleClearExit = () => { setCart([]); setScreen("catalog"); setShowIdle(false); };

  // Any interaction (tap, scroll, key) resets the inactivity timer (throttled to 1s)
  useEffect(() => {
    const onActivity = () => {
      if (showIdleRef.current) return; // modal handles its own countdown
      const now = Date.now();
      if (now - lastBumpRef.current < 1000) return;
      lastBumpRef.current = now;
      setIdleNonce(n => n + 1);
    };
    const events = ["pointerdown", "touchstart", "scroll", "keydown", "wheel"];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    return () => events.forEach(e => window.removeEventListener(e, onActivity, { capture: true }));
  }, []);

  // Arm the 20s idle timer only when the cart has items, on catalog/cart,
  // and not while the modal is up. Empty cart → no timer, no modal.
  useEffect(() => {
    if (showIdle) return;
    if (cart.length === 0) return;
    if (screen !== "catalog" && screen !== "cart") return;
    idleTimerRef.current = setTimeout(() => setShowIdle(true), IDLE_TIMEOUT_MS);
    return () => clearTimeout(idleTimerRef.current);
  }, [screen, showIdle, idleNonce, cart.length]);

  // Modal 15s countdown
  useEffect(() => {
    if (!showIdle) return;
    setIdleCountdown(IDLE_COUNTDOWN);
    const iv = setInterval(() => setIdleCountdown(c => c - 1), 1000);
    return () => clearInterval(iv);
  }, [showIdle]);

  useEffect(() => {
    if (showIdle && idleCountdown <= 0) idleClearExit();
  }, [showIdle, idleCountdown]);

  // Choose location: ?location=uuid, else show picker. Demo mode when no Supabase.
  useEffect(() => {
    if (!supabase) { setLocation({ id: null, name: "Демо-режим" }); return; }

    const loadList = () => {
      supabase.from("locations").select("*").eq("active", true).order("created_at")
        .then(({ data }) => {
          const list = data || [];
          setLocations(list);
          if (list.length === 1) setLocation(list[0]); // auto-enter single point
        });
    };

    const fromUrl = new URLSearchParams(window.location.search).get("location");
    if (fromUrl) {
      supabase.from("locations").select("*").eq("id", fromUrl).limit(1)
        .then(({ data }) => { data?.[0] ? setLocation(data[0]) : loadList(); });
    } else {
      loadList();
    }
  }, []);

  // Load products + banner for the active location
  useEffect(() => {
    if (!supabase || !location?.id) return;
    supabase.from("products").select("*").eq("location_id", location.id).eq("visible", true).order("created_at")
      .then(({ data }) => { if (data) setProducts(data); });
    supabase.from("banners").select("*").eq("location_id", location.id).eq("active", true).limit(1)
      .then(({ data }) => { if (data?.[0]) setBanner(data[0]); });
  }, [location]);

  useEffect(() => {
    if (screen !== "payment") return;
    setTimeLeft(60);
    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(iv); setScreen("catalog"); return 60; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [screen]);

  const filtered = category === "Все" ? products : products.filter(p => p.category === category);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = (product) => {
    const max = product.quantity ?? Infinity; // fallback products have no stock limit
    if (max <= 0) return;
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) {
        if (ex.qty >= max) return prev; // don't exceed available stock
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (item.qty === 1) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i);
    });
  };

  const handlePaymentSuccess = async () => {
    if (supabase) {
      try {
        const { data: order } = await supabase.from("orders").insert([{
          location_id: location?.id || null,
          items: cart.map(i => ({ id: i.id, name: i.name, emoji: i.emoji, image_url: i.image_url || null, price: i.price, qty: i.qty })),
          total,
          status: "paid",
        }]).select().single();

        // Fire Telegram notification (also decrements stock server-side). Non-blocking.
        if (order?.id) {
          supabase.functions.invoke("telegram-notify", { body: { order_id: order.id } }).catch(() => {});
        }
      } catch (e) {
        // ignore — never block the success screen on a logging/notification failure
      }
    }

    // Reflect stock locally so the catalog updates immediately
    setProducts(prev => prev.map(p => {
      if (p.quantity == null) return p;
      const ci = cart.find(c => c.id === p.id);
      return ci ? { ...p, quantity: Math.max(0, p.quantity - ci.qty) } : p;
    }));

    setCart([]);
    setScreen("success");
  };

  // ── LOCATION PICKER (first launch, no ?location=uuid) ──
  if (!location) {
    return (
      <div style={{
        minHeight: "100vh", background: "#fff", color: "#1a1a1a",
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto",
      }}>
        <div style={{
          background: "linear-gradient(180deg, #1c1c24 0%, #141419 100%)", padding: "20px", textAlign: "center",
          borderBottom: "1.5px solid rgba(255,45,85,0.55)",
          boxShadow: "0 4px 24px rgba(255,45,85,0.20)",
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>🏪 МикроМаркет</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>Выберите точку</div>
        </div>
        <div style={{ flex: 1, padding: "20px 16px", background: "#f8f8f8" }}>
          {!locations.length ? (
            <div style={{ padding: 48, textAlign: "center", color: "#bbb", fontSize: 14 }}>
              Загрузка точек...
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {locations.map(l => (
                <button key={l.id} onClick={() => setLocation(l)} style={{
                  background: "#fff", border: "2px solid #f0f0f0", borderRadius: 16,
                  padding: "18px 18px", textAlign: "left", cursor: "pointer",
                  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 14,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}>
                  <span style={{ fontSize: 32 }}>📍</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>{l.name}</div>
                    {l.address && <div style={{ fontSize: 13, color: "#999", marginTop: 2 }}>{l.address}</div>}
                  </div>
                  <span style={{ fontSize: 18, color: "#FF2D55", fontWeight: 900 }}>→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#ffffff",
      color: "#1a1a1a",
      fontFamily: "'Inter', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      maxWidth: 480,
      margin: "0 auto",
    }}>

      {/* ── HEADER ── */}
      <div style={{
        background: "linear-gradient(180deg, #1c1c24 0%, #141419 100%)",
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1.5px solid rgba(255,45,85,0.55)",
        boxShadow: "0 4px 24px rgba(255,45,85,0.20)",
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px", textShadow: "0 0 14px rgba(255,45,85,0.55)" }}>
            🏪 МикроМаркет
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>
            {location?.name || "БЦ Навои · этаж 3"}
          </div>
        </div>
        {screen !== "payment" && screen !== "success" && (
          <button onClick={() => cartCount > 0 && setScreen("cart")} style={{
            background: cartCount > 0 ? "#FFE83A" : "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: 12,
            padding: "9px 14px",
            color: cartCount > 0 ? "#1a1a1a" : "rgba(255,255,255,0.6)",
            fontSize: 13,
            fontWeight: 800,
            cursor: cartCount > 0 ? "pointer" : "default",
            fontFamily: "inherit",
            transition: "all 0.2s",
          }}>
            🛒 {cartCount > 0 ? `${cartCount} · ${formatPrice(total)}` : "Пусто"}
          </button>
        )}
      </div>

      {/* ── CATALOG ── */}
      {screen === "catalog" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

          {/* Promo banner from Supabase */}
          <div style={{
            background: banner.image_url
              ? `center/cover no-repeat url(${banner.image_url})`
              : banner.color,
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            position: "relative",
            overflow: "hidden",
          }}>
            {banner.image_url && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
            )}
            <span style={{ fontSize: 18, position: "relative" }}>{banner.emoji}</span>
            <span style={{
              fontSize: 13, fontWeight: 700, position: "relative",
              color: banner.image_url ? "#fff" : "#1a1a1a",
              textShadow: banner.image_url ? "0 1px 4px rgba(0,0,0,0.5)" : "none",
            }}>
              {banner.text}
            </span>
          </div>

          {/* Categories */}
          <div style={{
            display: "flex", gap: 8, padding: "12px 14px",
            overflowX: "auto", scrollbarWidth: "none",
            background: "#fff",
            borderBottom: "1px solid #f0f0f0",
          }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)} style={{
                padding: "7px 16px",
                borderRadius: 20,
                border: "none",
                background: category === cat ? "#FF2D55" : "#f5f5f5",
                color: category === cat ? "#fff" : "#666",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                whiteSpace: "nowrap", fontFamily: "inherit",
                transition: "all 0.15s",
              }}>{cat}</button>
            ))}
          </div>

          {/* Products grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: 12, padding: "12px 12px 100px",
            overflowY: "auto", background: "#f8f8f8",
          }}>
            {filtered.map(product => {
              const inCart = cart.find(i => i.id === product.id);
              const badge = product.badge && BADGE_MAP[product.badge];
              const out = product.quantity != null && product.quantity <= 0;
              return (
                <div key={product.id} style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: "14px 12px",
                  border: inCart ? "2px solid #FF2D55" : "2px solid #f0f0f0",
                  boxShadow: inCart
                    ? "0 4px 16px rgba(255,45,85,0.15)"
                    : "0 2px 8px rgba(0,0,0,0.06)",
                  transition: "all 0.15s",
                  position: "relative",
                  opacity: out ? 0.55 : 1,
                }}>
                  {badge && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        background: badge.bg, color: badge.color,
                        fontSize: 10, fontWeight: 800, padding: "3px 7px",
                        borderRadius: 6,
                      }}>
                        {badge.emoji} {badge.label}
                      </span>
                    </div>
                  )}
                  {product.image_url ? (
                    <div style={{
                      width: "100%", height: 120, marginBottom: 8, borderRadius: 12,
                      background: "#f7f7f7", border: "1px solid #f0f0f0",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden",
                    }}>
                      <img src={product.image_url} alt={product.name} style={{
                        maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                      }} />
                    </div>
                  ) : (
                    <div style={{
                      height: 120, marginBottom: 8, borderRadius: 12, background: "#f7f7f7",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52,
                    }}>{product.emoji}</div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 4, lineHeight: 1.3 }}>
                    {product.name}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#FF2D55", marginBottom: 10 }}>
                    {formatPrice(product.price)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {out ? (
                      <div style={{
                        width: "100%", padding: "8px 0", borderRadius: 10, textAlign: "center",
                        background: "#fff1f0", color: "#dc2626",
                        fontSize: 12, fontWeight: 800,
                      }}>Нет в наличии</div>
                    ) : inCart ? (
                      <>
                        <button onClick={() => removeFromCart(product.id)} style={{
                          width: 32, height: 32, borderRadius: 8, border: "none",
                          background: "#f5f5f5", color: "#333", fontSize: 18,
                          cursor: "pointer", fontWeight: 800, fontFamily: "inherit",
                        }}>−</button>
                        <span style={{ fontSize: 16, fontWeight: 900, minWidth: 24, textAlign: "center", color: "#FF2D55" }}>
                          {inCart.qty}
                        </span>
                        <button onClick={() => addToCart(product)} disabled={inCart.qty >= (product.quantity ?? Infinity)} style={{
                          width: 32, height: 32, borderRadius: 8, border: "none",
                          background: inCart.qty >= (product.quantity ?? Infinity) ? "#f0c0c4" : "#FF2D55",
                          color: "#fff", fontSize: 18,
                          cursor: inCart.qty >= (product.quantity ?? Infinity) ? "default" : "pointer",
                          fontWeight: 800, fontFamily: "inherit",
                        }}>+</button>
                      </>
                    ) : (
                      <button onClick={() => addToCart(product)} style={{
                        width: "100%", padding: "8px 0", borderRadius: 10,
                        border: "none", background: "#FFE83A", color: "#1a1a1a",
                        fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                      }}>+ Добавить</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CART ── */}
      {screen === "cart" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8f8f8" }}>
          <div style={{ background: "#fff", padding: "14px 16px", borderBottom: "1px solid #f0f0f0" }}>
            <button onClick={() => setScreen("catalog")} style={{
              background: "none", border: "none", color: "#FF2D55",
              fontSize: 14, cursor: "pointer", fontWeight: 700, fontFamily: "inherit",
              padding: "0 0 10px", display: "block",
            }}>← Назад к каталогу</button>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>🛒 Ваш заказ</div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", background: "#fff", margin: "12px 12px 0", borderRadius: 16, padding: "0 16px" }}>
            {cart.map(item => (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 0", borderBottom: "1px solid #f5f5f5",
              }}>
                {item.image_url ? (
                  <div style={{
                    width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                    background: "#f7f7f7", border: "1px solid #f0f0f0",
                    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                  }}>
                    <img src={item.image_url} alt={item.name} style={{
                      maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                    }} />
                  </div>
                ) : (
                  <span style={{ fontSize: 28 }}>{item.emoji}</span>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "#999" }}>{formatPrice(item.price)} × {item.qty}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => removeFromCart(item.id)} style={{
                    width: 28, height: 28, borderRadius: 7, border: "none",
                    background: "#f5f5f5", color: "#333", fontSize: 16,
                    cursor: "pointer", fontFamily: "inherit", fontWeight: 800,
                  }}>−</button>
                  <span style={{ fontSize: 14, fontWeight: 800, minWidth: 20, textAlign: "center", color: "#FF2D55" }}>
                    {item.qty}
                  </span>
                  <button onClick={() => addToCart(item)} style={{
                    width: 28, height: 28, borderRadius: 7, border: "none",
                    background: "#FF2D55", color: "#fff", fontSize: 16,
                    cursor: "pointer", fontFamily: "inherit", fontWeight: 800,
                  }}>+</button>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#FF2D55", minWidth: 72, textAlign: "right" }}>
                  {formatPrice(item.price * item.qty)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: "16px 12px", background: "#f8f8f8" }}>
            <div style={{
              background: "#fff", borderRadius: 16, padding: "14px 16px", marginBottom: 10,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#333" }}>Итого</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#FF2D55" }}>{formatPrice(total)}</span>
            </div>
            <button onClick={() => setScreen("payment")} style={{
              width: "100%", padding: 16, borderRadius: 14, border: "none",
              background: "#FF2D55", color: "#fff", fontSize: 16, fontWeight: 800,
              cursor: "pointer", fontFamily: "inherit", marginBottom: 8,
              boxShadow: "0 4px 16px rgba(255,45,85,0.35)",
            }}>
              Оплатить через Payme / Click →
            </button>
            <button onClick={() => { setCart([]); setScreen("catalog"); }} style={{
              width: "100%", padding: 12, borderRadius: 14,
              border: "1.5px solid #e0e0e0", background: "#fff",
              color: "#999", fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
            }}>
              Очистить корзину
            </button>
          </div>
        </div>
      )}

      {/* ── PAYMENT ── */}
      {screen === "payment" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: 24, textAlign: "center", background: "#fff",
        }}>
          <div style={{ fontSize: 13, color: "#999", marginBottom: 6 }}>К оплате</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#FF2D55", marginBottom: 4 }}>
            {formatPrice(total)}
          </div>
          <div style={{ fontSize: 13, color: "#999", marginBottom: 22 }}>
            Отсканируйте QR в Payme или Click
          </div>

          <div style={{
            background: "#fff", borderRadius: 20, padding: 16, marginBottom: 18,
            boxShadow: "0 8px 32px rgba(255,45,85,0.15)",
            border: "3px solid #FFE83A",
          }}>
            <QRPattern value={paymentRef + total} size={190} />
          </div>

          <div style={{ fontSize: 11, color: "#ccc", marginBottom: 20, fontFamily: "monospace" }}>
            {paymentRef}-{total}
          </div>

          <div style={{ width: "100%", marginBottom: 22 }}>
            <div style={{
              background: "#f0f0f0", borderRadius: 10, height: 7, overflow: "hidden", marginBottom: 6,
            }}>
              <div style={{
                height: "100%", borderRadius: 10,
                background: "linear-gradient(90deg, #FFE83A, #FF2D55)",
                width: `${(timeLeft / 60) * 100}%`,
                transition: "width 1s linear",
              }} />
            </div>
            <div style={{ fontSize: 12, color: "#aaa" }}>⏱ Осталось {timeLeft} сек</div>
          </div>

          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button onClick={() => setScreen("cart")} style={{
              flex: 1, padding: 14, borderRadius: 12, fontFamily: "inherit",
              border: "1.5px solid #e0e0e0", background: "#fff",
              color: "#999", fontSize: 14, cursor: "pointer", fontWeight: 600,
            }}>← Назад</button>
            <button onClick={handlePaymentSuccess} style={{
              flex: 2, padding: 14, borderRadius: 12, fontFamily: "inherit",
              border: "none", background: "#16a34a",
              color: "#fff", fontSize: 14, cursor: "pointer", fontWeight: 800,
            }}>✓ Симулировать оплату</button>
          </div>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {screen === "success" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: 32, textAlign: "center", background: "#fff",
        }}>
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            background: "#FFE83A",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 48, marginBottom: 22,
            boxShadow: "0 8px 32px rgba(255,232,58,0.4)",
          }}>✅</div>

          <div style={{ fontSize: 28, fontWeight: 900, color: "#1a1a1a", marginBottom: 8 }}>
            Оплата прошла!
          </div>
          <div style={{ fontSize: 15, color: "#666", marginBottom: 28, lineHeight: 1.7 }}>
            Возьмите ваши товары с полки.<br />
            <span style={{ color: "#FF2D55", fontWeight: 700 }}>Приятного аппетита! 🍽</span>
          </div>

          <div style={{
            background: "#f8f8f8", borderRadius: 12, padding: "12px 20px", marginBottom: 28,
            fontSize: 11, color: "#bbb", fontFamily: "monospace",
            border: "1px solid #f0f0f0",
          }}>
            Чек: {paymentRef}-{total}
          </div>

          <button onClick={() => setScreen("catalog")} style={{
            padding: "16px 48px", borderRadius: 14, fontFamily: "inherit",
            border: "none", background: "#FF2D55",
            color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(255,45,85,0.35)",
          }}>← На главную</button>
        </div>
      )}

      {/* ── INACTIVITY MODAL ── */}
      {showIdle && screen !== "payment" && screen !== "success" && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2000,
          background: "rgba(26,26,26,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24, fontFamily: "'Inter', system-ui, sans-serif",
        }}>
          <div style={{
            background: "#fff", borderRadius: 24, padding: "32px 28px",
            width: "100%", maxWidth: 360, textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            border: "3px solid #FFE83A",
          }}>
            <div style={{
              width: 88, height: 88, borderRadius: "50%", background: "#FFE83A",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 44, margin: "0 auto 18px",
              boxShadow: "0 8px 28px rgba(255,232,58,0.45)",
            }}>🛒</div>

            <div style={{ fontSize: 24, fontWeight: 900, color: "#1a1a1a", marginBottom: 10 }}>
              Вы ещё здесь?
            </div>
            <div style={{ fontSize: 15, color: "#666", marginBottom: 6, lineHeight: 1.5 }}>
              Ваша корзина будет очищена через
            </div>
            <div style={{ fontSize: 44, fontWeight: 900, color: "#FF2D55", marginBottom: 24, lineHeight: 1 }}>
              {Math.max(0, idleCountdown)}
              <span style={{ fontSize: 15, fontWeight: 700, color: "#999", marginLeft: 6 }}>сек</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={idleContinue} style={{
                width: "100%", padding: 16, borderRadius: 14, border: "none",
                background: "#FF2D55", color: "#fff", fontSize: 16, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 16px rgba(255,45,85,0.35)",
              }}>Продолжить покупку</button>
              <button onClick={idleClearExit} style={{
                width: "100%", padding: 14, borderRadius: 14,
                border: "1.5px solid #e0e0e0", background: "#fff",
                color: "#999", fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>Очистить и выйти</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
