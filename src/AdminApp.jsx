import { useState, useEffect, useCallback } from "react";
import { supabase, uploadImage } from "./supabase";

const ADMIN_PASS = "admin123";

const BADGE_MAP = {
  hit:  { emoji: "🔥", label: "Хит",       bg: "#E8000D", color: "#fff" },
  new:  { emoji: "✨", label: "Новинка",    bg: "#7c3aed", color: "#fff" },
  sale: { emoji: "🏷", label: "Акция",      bg: "#d97706", color: "#fff" },
  last: { emoji: "⚠️", label: "Последний",  bg: "#ca8a04", color: "#1a1a1a" },
};

const CATEGORIES = ["Напитки", "Снеки", "Еда", "Кофе"];

function formatPrice(p) {
  return Number(p).toLocaleString("ru-RU") + " сум";
}

function formatDate(ts) {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── SHARED STYLES ──────────────────────────────────────────────────
const S = {
  label: {
    display: "block", fontSize: 11, fontWeight: 700, color: "#888",
    marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em",
  },
  input: {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1.5px solid #e0e0e0", fontSize: 14, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box", background: "#fff",
  },
  btnPrimary: {
    padding: "11px 20px", borderRadius: 8, border: "none",
    background: "#E8000D", color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  },
  btnSecondary: {
    padding: "11px 20px", borderRadius: 8, fontFamily: "inherit",
    border: "1.5px solid #e0e0e0", background: "#fff",
    color: "#555", fontSize: 14, cursor: "pointer", fontWeight: 600,
  },
  errorBox: {
    background: "#fff1f0", border: "1px solid #ffa39e", borderRadius: 8,
    padding: "10px 14px", marginBottom: 16, color: "#cf1322", fontSize: 13,
  },
  card: {
    background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8",
  },
};

// ── TOGGLE SWITCH ──────────────────────────────────────────────────
function Toggle({ on, onChange, labelOn = "Да", labelOff = "Нет" }) {
  return (
    <div onClick={() => onChange(!on)} style={{
      display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer",
      padding: "8px 12px", borderRadius: 8,
      background: on ? "#f0fdf4" : "#f9f9f9",
      border: `1.5px solid ${on ? "#86efac" : "#e0e0e0"}`,
      userSelect: "none",
    }}>
      <div style={{
        width: 36, height: 20, borderRadius: 10,
        background: on ? "#16a34a" : "#d1d5db",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 2, left: on ? 18 : 2,
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }} />
      </div>
      <span style={{ fontSize: 13, color: on ? "#16a34a" : "#888", fontWeight: 600 }}>
        {on ? labelOn : labelOff}
      </span>
    </div>
  );
}

// ── IMAGE UPLOAD ───────────────────────────────────────────────────
function ImageUpload({ value, onChange, fallback }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setUploading(true);
    setErr("");
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (ex) {
      setErr(ex.message || "Ошибка загрузки");
    }
    setUploading(false);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 10, flexShrink: 0,
          border: "1.5px solid #e0e0e0", background: "#fafafa",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", fontSize: 30,
        }}>
          {value
            ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span>{fallback || "🖼"}</span>}
        </div>
        <div style={{ flex: 1 }}>
          <label style={{
            ...S.btnSecondary, display: "inline-block", textAlign: "center",
            cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1,
            padding: "9px 16px",
          }}>
            {uploading ? "Загрузка..." : (value ? "Заменить фото" : "📷 Загрузить фото")}
            <input type="file" accept="image/*" onChange={handleFile}
              disabled={uploading} style={{ display: "none" }} />
          </label>
          {value && !uploading && (
            <button type="button" onClick={() => onChange(null)} style={{
              marginLeft: 8, padding: "9px 14px", borderRadius: 8,
              border: "1px solid #fca5a5", background: "#fff1f0", color: "#dc2626",
              fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
            }}>Убрать</button>
          )}
        </div>
      </div>
      {err && <div style={{ color: "#E8000D", fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}

// ── STATUS PILL ────────────────────────────────────────────────────
function StatusPill({ on, labelOn, labelOff, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      cursor: onClick ? "pointer" : "default",
      padding: "4px 10px", borderRadius: 20,
      background: on ? "#f0fdf4" : "#f5f5f5",
      border: `1px solid ${on ? "#86efac" : "#e0e0e0"}`,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: on ? "#16a34a" : "#bbb" }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: on ? "#16a34a" : "#888" }}>
        {on ? labelOn : labelOff}
      </span>
    </div>
  );
}

// ── MODAL ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480,
        maxHeight: "92vh", overflow: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #f0f0f0",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "sticky", top: 0, background: "#fff", zIndex: 1,
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>{title}</div>
          <button onClick={onClose} style={{
            background: "#f5f5f5", border: "none", borderRadius: 8,
            width: 32, height: 32, fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>
        <div style={{ padding: "20px 20px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── PRODUCT FORM ───────────────────────────────────────────────────
function ProductForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name:      initial?.name      || "",
    price:     initial?.price     || "",
    emoji:     initial?.emoji     || "🛍",
    category:  initial?.category  || "Напитки",
    badge:     initial?.badge     || "",
    image_url: initial?.image_url || null,
    quantity:  initial?.quantity  ?? 0,
    visible:   initial?.visible   ?? true,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    onSave({
      ...form,
      price: parseInt(form.price, 10),
      quantity: Math.max(0, parseInt(form.quantity, 10) || 0),
      badge: form.badge || null,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: "0 0 82px" }}>
          <label style={S.label}>Эмодзи</label>
          <input value={form.emoji} onChange={e => set("emoji", e.target.value)}
            style={{ ...S.input, textAlign: "center", fontSize: 26 }} maxLength={4} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Название *</label>
          <input value={form.name} onChange={e => set("name", e.target.value)}
            placeholder="Coca-Cola 0.5л" style={S.input} required />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Фото товара</label>
        <ImageUpload value={form.image_url} onChange={v => set("image_url", v)} fallback={form.emoji} />
        <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>
          Если фото загружено, в киоске оно показывается вместо эмодзи.
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Цена (сум) *</label>
          <input type="number" value={form.price} onChange={e => set("price", e.target.value)}
            placeholder="8000" min="1" style={S.input} required />
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Категория</label>
          <select value={form.category} onChange={e => set("category", e.target.value)} style={S.input}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Бейдж</label>
          <select value={form.badge} onChange={e => set("badge", e.target.value)} style={S.input}>
            <option value="">— без бейджа —</option>
            {Object.entries(BADGE_MAP).map(([k, v]) => (
              <option key={k} value={k}>{v.emoji} {v.label}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Кол-во на складе</label>
          <input type="number" value={form.quantity} onChange={e => set("quantity", e.target.value)}
            min="0" style={S.input} />
          <div style={{ fontSize: 11, color: form.quantity == 0 ? "#E8000D" : "#aaa", marginTop: 4 }}>
            {form.quantity == 0 ? "0 — товар скрыт как «Нет в наличии»" : "0 = нет в наличии"}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Видимость</label>
        <Toggle on={form.visible} onChange={v => set("visible", v)} labelOn="Виден" labelOff="Скрыт" />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button type="button" onClick={onClose} style={{ ...S.btnSecondary, flex: 1 }}>Отмена</button>
        <button type="submit" disabled={saving} style={{
          ...S.btnPrimary, flex: 2,
          background: saving ? "#ccc" : "#E8000D",
          cursor: saving ? "default" : "pointer",
        }}>
          {saving ? "Сохранение..." : (initial ? "Сохранить изменения" : "Добавить товар")}
        </button>
      </div>
    </form>
  );
}

// ── BANNER FORM ────────────────────────────────────────────────────
function BannerForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    text:      initial?.text      || "",
    emoji:     initial?.emoji     || "🔥",
    color:     initial?.color     || "#FFD600",
    image_url: initial?.image_url || null,
    active:    initial?.active    ?? true,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: "0 0 82px" }}>
          <label style={S.label}>Эмодзи</label>
          <input value={form.emoji} onChange={e => set("emoji", e.target.value)}
            style={{ ...S.input, textAlign: "center", fontSize: 24 }} maxLength={4} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Текст баннера *</label>
          <input value={form.text} onChange={e => set("text", e.target.value)}
            placeholder="Свежая еда и напитки!" style={S.input} required />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Цвет фона</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={form.color} onChange={e => set("color", e.target.value)}
              style={{ width: 44, height: 40, padding: 2, borderRadius: 6, border: "1.5px solid #e0e0e0", cursor: "pointer" }} />
            <input value={form.color} onChange={e => set("color", e.target.value)}
              placeholder="#FFD600" style={{ ...S.input, flex: 1 }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Активен</label>
          <Toggle on={form.active} onChange={v => set("active", v)} labelOn="Активен" labelOff="Выкл" />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Фото баннера</label>
        <ImageUpload value={form.image_url} onChange={v => set("image_url", v)} fallback={form.emoji} />
        <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>
          Если фото загружено, оно показывается фоном баннера вместо цвета.
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={S.label}>Предпросмотр</label>
        <div style={{
          background: form.image_url ? `center/cover no-repeat url(${form.image_url})` : form.color,
          borderRadius: 8, padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 8, position: "relative", overflow: "hidden",
        }}>
          {form.image_url && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)" }} />
          )}
          <span style={{ fontSize: 18, position: "relative" }}>{form.emoji}</span>
          <span style={{
            fontSize: 13, fontWeight: 700, position: "relative",
            color: form.image_url ? "#fff" : "#1a1a1a",
            textShadow: form.image_url ? "0 1px 4px rgba(0,0,0,0.5)" : "none",
          }}>{form.text || "..."}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" onClick={onClose} style={{ ...S.btnSecondary, flex: 1 }}>Отмена</button>
        <button type="submit" disabled={saving} style={{
          ...S.btnPrimary, flex: 2,
          background: saving ? "#ccc" : "#E8000D",
          cursor: saving ? "default" : "pointer",
        }}>
          {saving ? "Сохранение..." : (initial ? "Сохранить изменения" : "Добавить баннер")}
        </button>
      </div>
    </form>
  );
}

// ── PRODUCTS TAB ───────────────────────────────────────────────────
function ProductsTab({ locationId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [modal, setModal]     = useState(null);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products").select("*").eq("location_id", locationId)
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setProducts(data || []);
    setLoading(false);
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    setSaving(true);
    setError("");
    const { error } = modal === "add"
      ? await supabase.from("products").insert([{ ...form, location_id: locationId }])
      : await supabase.from("products").update(form).eq("id", modal.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setModal(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Удалить товар? Это действие нельзя отменить.")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) setError(error.message);
    else setProducts(ps => ps.filter(p => p.id !== id));
  };

  const toggleVisible = async (p) => {
    const { error } = await supabase.from("products").update({ visible: !p.visible }).eq("id", p.id);
    if (!error) setProducts(ps => ps.map(x => x.id === p.id ? { ...x, visible: !x.visible } : x));
  };

  return (
    <div>
      {error && <div style={S.errorBox}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>
          Товары{" "}
          <span style={{ fontSize: 14, fontWeight: 500, color: "#aaa" }}>({products.length})</span>
        </h2>
        <button onClick={() => setModal("add")} style={S.btnPrimary}>+ Добавить товар</button>
      </div>

      {loading && !products.length ? (
        <div style={{ padding: 48, textAlign: "center", color: "#bbb" }}>Загрузка...</div>
      ) : (
        <div style={{ ...S.card, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "1px solid #ececec" }}>
                {["Товар", "Категория", "Цена", "Бейдж", "Кол-во", "Виден", ""].map(h => (
                  <th key={h} style={{
                    padding: "10px 14px", textAlign: "left",
                    fontSize: 11, fontWeight: 700, color: "#999",
                    textTransform: "uppercase", letterSpacing: "0.04em",
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id} style={{
                  borderBottom: i < products.length - 1 ? "1px solid #f5f5f5" : "none",
                  opacity: p.visible ? 1 : 0.5,
                }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt="" style={{
                          width: 36, height: 36, borderRadius: 8, objectFit: "cover",
                          border: "1px solid #eee", flexShrink: 0,
                        }} />
                      ) : (
                        <span style={{ fontSize: 24, lineHeight: 1, width: 36, textAlign: "center" }}>{p.emoji}</span>
                      )}
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#777" }}>{p.category}</td>
                  <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 700, color: "#E8000D", whiteSpace: "nowrap" }}>
                    {formatPrice(p.price)}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {p.badge && BADGE_MAP[p.badge] ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: BADGE_MAP[p.badge].bg, color: BADGE_MAP[p.badge].color,
                      }}>
                        {BADGE_MAP[p.badge].emoji} {BADGE_MAP[p.badge].label}
                      </span>
                    ) : <span style={{ color: "#ddd" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {p.quantity > 0 ? (
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: p.quantity <= 5 ? "#d97706" : "#16a34a",
                      }}>{p.quantity} шт</span>
                    ) : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: "#fff1f0", color: "#dc2626",
                      }}>Нет в наличии</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <StatusPill
                      on={p.visible}
                      labelOn="Виден"
                      labelOff="Скрыт"
                      onClick={() => toggleVisible(p)}
                    />
                  </td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    <button onClick={() => setModal(p)} style={{
                      padding: "6px 12px", borderRadius: 6, border: "1px solid #e0e0e0",
                      background: "#fff", color: "#444", fontSize: 13, cursor: "pointer",
                      fontFamily: "inherit", marginRight: 6, fontWeight: 600,
                    }}>✏️ Ред.</button>
                    <button onClick={() => handleDelete(p.id)} style={{
                      padding: "6px 12px", borderRadius: 6, border: "1px solid #fca5a5",
                      background: "#fff1f0", color: "#dc2626", fontSize: 13,
                      cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                    }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!products.length && !loading && (
            <div style={{ padding: 40, textAlign: "center", color: "#bbb", fontSize: 14 }}>
              Нет товаров — добавьте первый!
            </div>
          )}
        </div>
      )}

      {modal !== null && (
        <Modal
          title={modal === "add" ? "Добавить товар" : "Редактировать товар"}
          onClose={() => setModal(null)}
        >
          <ProductForm
            initial={modal === "add" ? null : modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
            saving={saving}
          />
        </Modal>
      )}
    </div>
  );
}

// ── BANNERS TAB ────────────────────────────────────────────────────
function BannersTab({ locationId }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [modal, setModal]     = useState(null);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("banners").select("*").eq("location_id", locationId)
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setBanners(data || []);
    setLoading(false);
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    setSaving(true);
    setError("");
    const { error } = modal === "add"
      ? await supabase.from("banners").insert([{ ...form, location_id: locationId }])
      : await supabase.from("banners").update(form).eq("id", modal.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setModal(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Удалить баннер?")) return;
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) setError(error.message);
    else setBanners(bs => bs.filter(b => b.id !== id));
  };

  const toggleActive = async (b) => {
    const { error } = await supabase.from("banners").update({ active: !b.active }).eq("id", b.id);
    if (!error) setBanners(bs => bs.map(x => x.id === b.id ? { ...x, active: !x.active } : x));
  };

  return (
    <div>
      {error && <div style={S.errorBox}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>
          Баннеры{" "}
          <span style={{ fontSize: 14, fontWeight: 500, color: "#aaa" }}>({banners.length})</span>
        </h2>
        <button onClick={() => setModal("add")} style={S.btnPrimary}>+ Добавить баннер</button>
      </div>

      <div style={{ fontSize: 13, color: "#999", marginBottom: 16 }}>
        Баннер отображается в верхней цветной полосе киоска. Показывается первый активный.
      </div>

      {loading && !banners.length ? (
        <div style={{ padding: 48, textAlign: "center", color: "#bbb" }}>Загрузка...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {banners.map(b => (
            <div key={b.id} style={{
              ...S.card, padding: "16px 18px",
              display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
            }}>
              <div style={{
                background: b.image_url ? `center/cover no-repeat url(${b.image_url})` : b.color,
                borderRadius: 8, padding: "9px 16px",
                display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 220,
                position: "relative", overflow: "hidden",
              }}>
                {b.image_url && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)" }} />
                )}
                <span style={{ fontSize: 18, flexShrink: 0, position: "relative" }}>{b.emoji}</span>
                <span style={{
                  fontSize: 13, fontWeight: 700, position: "relative",
                  color: b.image_url ? "#fff" : "#1a1a1a",
                  textShadow: b.image_url ? "0 1px 4px rgba(0,0,0,0.5)" : "none",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {b.text}
                </span>
              </div>

              <StatusPill on={b.active} labelOn="Активен" labelOff="Выкл" onClick={() => toggleActive(b)} />

              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => setModal(b)} style={{
                  padding: "7px 13px", borderRadius: 6, border: "1px solid #e0e0e0",
                  background: "#fff", color: "#444", fontSize: 13, cursor: "pointer",
                  fontFamily: "inherit", fontWeight: 600,
                }}>✏️ Ред.</button>
                <button onClick={() => handleDelete(b.id)} style={{
                  padding: "7px 13px", borderRadius: 6, border: "1px solid #fca5a5",
                  background: "#fff1f0", color: "#dc2626", fontSize: 13,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                }}>🗑</button>
              </div>
            </div>
          ))}
          {!banners.length && !loading && (
            <div style={{ ...S.card, padding: 40, textAlign: "center", color: "#bbb", fontSize: 14 }}>
              Нет баннеров — добавьте первый!
            </div>
          )}
        </div>
      )}

      {modal !== null && (
        <Modal
          title={modal === "add" ? "Добавить баннер" : "Редактировать баннер"}
          onClose={() => setModal(null)}
        >
          <BannerForm
            initial={modal === "add" ? null : modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
            saving={saving}
          />
        </Modal>
      )}
    </div>
  );
}

// ── ORDERS TAB ─────────────────────────────────────────────────────
function OrdersTab({ locationId }) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    setLoading(true);
    supabase.from("orders").select("*").eq("location_id", locationId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setOrders(data || []); setLoading(false); });
  }, [locationId]);

  const paidOrders = orders.filter(o => o.status === "paid");
  const totalRevenue = paidOrders.reduce((s, o) => s + o.total, 0);

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Всего заказов",  value: orders.length,      color: "#1a1a1a" },
          { label: "Оплачено",       value: paidOrders.length,  color: "#16a34a" },
          { label: "Общая выручка",  value: formatPrice(totalRevenue), color: "#E8000D" },
        ].map(s => (
          <div key={s.label} style={{ ...S.card, flex: 1, minWidth: 140, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>
        История заказов
      </h2>

      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#bbb" }}>Загрузка...</div>
      ) : (
        <div style={{ ...S.card, overflow: "hidden" }}>
          {!orders.length ? (
            <div style={{ padding: 40, textAlign: "center", color: "#bbb", fontSize: 14 }}>
              Заказов пока нет
            </div>
          ) : orders.map((o, i) => (
            <div key={o.id} style={{ borderBottom: i < orders.length - 1 ? "1px solid #f5f5f5" : "none" }}>
              <div
                onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                style={{
                  padding: "14px 18px", cursor: "pointer", display: "flex",
                  alignItems: "center", gap: 14,
                  background: expanded === o.id ? "#fafafa" : "#fff",
                  transition: "background 0.1s",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#bbb", marginBottom: 2 }}>
                    {formatDate(o.created_at)} · <span style={{ fontFamily: "monospace" }}>{o.id.slice(0, 8)}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>
                    {Array.isArray(o.items) ? `${o.items.reduce((s, i) => s + (i.qty || 1), 0)} товар(а)` : "—"}
                    {Array.isArray(o.items) && (
                      <span style={{ fontSize: 12, color: "#aaa", fontWeight: 400, marginLeft: 8 }}>
                        {o.items.map(i => i.name).join(", ").slice(0, 50)}
                        {o.items.map(i => i.name).join(", ").length > 50 ? "..." : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#E8000D" }}>
                    {formatPrice(o.total)}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, marginTop: 3, padding: "2px 8px",
                    borderRadius: 10, display: "inline-block",
                    background: o.status === "paid" ? "#f0fdf4" : "#fff7e6",
                    color: o.status === "paid" ? "#16a34a" : "#d97706",
                  }}>
                    {o.status === "paid" ? "✓ Оплачен" : "⏳ Ожидание"}
                  </div>
                </div>
                <div style={{ color: "#ccc", fontSize: 12, flexShrink: 0 }}>
                  {expanded === o.id ? "▲" : "▼"}
                </div>
              </div>

              {expanded === o.id && Array.isArray(o.items) && (
                <div style={{ padding: "2px 18px 14px 18px", background: "#fafafa" }}>
                  <div style={{ borderTop: "1px solid #efefef", paddingTop: 10 }}>
                    {o.items.map((item, j) => (
                      <div key={j} style={{
                        display: "flex", justifyContent: "space-between",
                        padding: "5px 0", fontSize: 13, color: "#555",
                      }}>
                        <span>{item.emoji} {item.name} × {item.qty || 1}</span>
                        <span style={{ fontWeight: 700, color: "#333" }}>
                          {formatPrice((item.price || 0) * (item.qty || 1))}
                        </span>
                      </div>
                    ))}
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      borderTop: "1px solid #ececec", paddingTop: 8, marginTop: 6,
                      fontSize: 14, fontWeight: 800,
                    }}>
                      <span style={{ color: "#888" }}>Итого</span>
                      <span style={{ color: "#E8000D" }}>{formatPrice(o.total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── LOCATION FORM ──────────────────────────────────────────────────
function LocationForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name:    initial?.name    || "",
    address: initial?.address || "",
    active:  initial?.active  ?? true,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Название точки *</label>
        <input value={form.name} onChange={e => set("name", e.target.value)}
          placeholder="БЦ Навои · этаж 3" style={S.input} required autoFocus />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Адрес</label>
        <input value={form.address} onChange={e => set("address", e.target.value)}
          placeholder="Ташкент, ул. Навои 1" style={S.input} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={S.label}>Статус</label>
        <Toggle on={form.active} onChange={v => set("active", v)} labelOn="Активна" labelOff="Выкл" />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" onClick={onClose} style={{ ...S.btnSecondary, flex: 1 }}>Отмена</button>
        <button type="submit" disabled={saving} style={{
          ...S.btnPrimary, flex: 2,
          background: saving ? "#ccc" : "#E8000D",
          cursor: saving ? "default" : "pointer",
        }}>
          {saving ? "Сохранение..." : (initial ? "Сохранить" : "Добавить точку")}
        </button>
      </div>
    </form>
  );
}

// ── LOCATIONS SCREEN ───────────────────────────────────────────────
function LocationsScreen({ onEnter, onLogout }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [modal, setModal]     = useState(null);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("locations").select("*").order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setLocations(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    setSaving(true);
    setError("");
    const { error } = modal === "add"
      ? await supabase.from("locations").insert([form])
      : await supabase.from("locations").update(form).eq("id", modal.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setModal(null);
    load();
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Удалить точку? Все её товары, баннеры и заказы тоже будут удалены.")) return;
    const { error } = await supabase.from("locations").delete().eq("id", id);
    if (error) setError(error.message);
    else setLocations(ls => ls.filter(l => l.id !== id));
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#f3f4f6",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        background: "#E8000D", padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 16px rgba(232,0,13,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🏪</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>МикроМаркет</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.03em" }}>АДМИНИСТРАТОР</div>
          </div>
        </div>
        <button onClick={onLogout} style={{
          padding: "8px 14px", borderRadius: 8, fontFamily: "inherit",
          border: "1.5px solid rgba(255,255,255,0.25)", background: "transparent",
          color: "rgba(255,255,255,0.75)", fontSize: 12, cursor: "pointer", fontWeight: 600,
        }}>Выйти</button>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 24px" }}>
        {error && <div style={S.errorBox}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1a1a1a" }}>Точки продаж</h2>
            <div style={{ fontSize: 13, color: "#999", marginTop: 4 }}>Выберите точку для управления</div>
          </div>
          <button onClick={() => setModal("add")} style={S.btnPrimary}>+ Добавить точку</button>
        </div>

        {loading && !locations.length ? (
          <div style={{ padding: 48, textAlign: "center", color: "#bbb" }}>Загрузка...</div>
        ) : !locations.length ? (
          <div style={{ ...S.card, padding: 48, textAlign: "center", color: "#bbb", fontSize: 14 }}>
            Точек пока нет — добавьте первую!
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {locations.map(l => (
              <div key={l.id} onClick={() => onEnter(l)} style={{
                ...S.card, padding: "18px 20px", cursor: "pointer",
                borderColor: l.active ? "#e8e8e8" : "#eee",
                opacity: l.active ? 1 : 0.6, transition: "all 0.15s",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 28 }}>📍</span>
                  <StatusPill on={l.active} labelOn="Активна" labelOff="Выкл" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.25 }}>{l.name}</div>
                {l.address && <div style={{ fontSize: 13, color: "#999" }}>{l.address}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={(e) => { e.stopPropagation(); setModal(l); }} style={{
                    padding: "6px 12px", borderRadius: 6, border: "1px solid #e0e0e0",
                    background: "#fff", color: "#444", fontSize: 12, cursor: "pointer",
                    fontFamily: "inherit", fontWeight: 600,
                  }}>✏️ Ред.</button>
                  <button onClick={(e) => handleDelete(e, l.id)} style={{
                    padding: "6px 12px", borderRadius: 6, border: "1px solid #fca5a5",
                    background: "#fff1f0", color: "#dc2626", fontSize: 12,
                    cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                  }}>🗑</button>
                  <div style={{ flex: 1, textAlign: "right", color: "#E8000D", fontSize: 13, fontWeight: 700, alignSelf: "center" }}>
                    Открыть →
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal !== null && (
        <Modal title={modal === "add" ? "Новая точка" : "Редактировать точку"} onClose={() => setModal(null)}>
          <LocationForm
            initial={modal === "add" ? null : modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
            saving={saving}
          />
        </Modal>
      )}
    </div>
  );
}

// ── LOGIN ──────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASS) { onLogin(true); }
    else { setError("Неверный пароль"); setPassword(""); }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#f3f4f6",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "44px 40px",
        width: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.10)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🏪</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#1a1a1a" }}>МикроМаркет</div>
          <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>Панель администратора</div>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={{ ...S.label, marginBottom: 6 }}>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            placeholder="••••••••"
            autoFocus
            style={{
              ...S.input, marginBottom: error ? 6 : 16,
              border: error ? "1.5px solid #E8000D" : "1.5px solid #e0e0e0",
            }}
          />
          {error && <div style={{ color: "#E8000D", fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <button type="submit" style={{ ...S.btnPrimary, width: "100%", padding: "14px 0", fontSize: 15 }}>
            Войти →
          </button>
        </form>
      </div>
    </div>
  );
}

// ── NOT CONFIGURED ─────────────────────────────────────────────────
function NotConfigured() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', system-ui, sans-serif", background: "#f3f4f6", padding: 24,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "36px 32px", maxWidth: 420,
        textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>⚙️</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Supabase не настроен</div>
        <div style={{ fontSize: 14, color: "#666", lineHeight: 1.7 }}>
          Создайте файл <code style={{ background: "#f5f5f5", padding: "2px 6px", borderRadius: 4 }}>.env</code> в корне проекта:<br /><br />
          <code style={{ display: "block", background: "#f5f5f5", padding: "10px 14px", borderRadius: 8, textAlign: "left", fontSize: 13, lineHeight: 1.8 }}>
            VITE_SUPABASE_URL=https://xxx.supabase.co<br />
            VITE_SUPABASE_ANON_KEY=your-anon-key
          </code>
        </div>
      </div>
    </div>
  );
}

// ── ROOT ───────────────────────────────────────────────────────────
export default function AdminApp() {
  const [authed, setAuthed]     = useState(false);
  const [location, setLocation] = useState(null);
  const [tab, setTab]           = useState("products");

  if (!supabase) return <NotConfigured />;
  if (!authed)   return <LoginScreen onLogin={setAuthed} />;
  if (!location) return <LocationsScreen onEnter={(l) => { setLocation(l); setTab("products"); }} onLogout={() => setAuthed(false)} />;

  const TABS = [
    { id: "products", label: "🛍 Товары" },
    { id: "banners",  label: "📢 Баннеры" },
    { id: "orders",   label: "📋 Заказы" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#f3f4f6",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Navbar */}
      <div style={{
        background: "#E8000D", padding: "0 24px",
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        boxShadow: "0 2px 16px rgba(232,0,13,0.3)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ padding: "14px 0", display: "flex", alignItems: "center", gap: 10, marginRight: 8 }}>
          <span style={{ fontSize: 20 }}>🏪</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>МикроМаркет</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.03em" }}>АДМИНИСТРАТОР</div>
          </div>
        </div>

        {/* Current location + switch */}
        <button onClick={() => setLocation(null)} title="Сменить точку" style={{
          display: "flex", alignItems: "center", gap: 6, marginRight: 8,
          padding: "7px 12px", borderRadius: 8, fontFamily: "inherit", cursor: "pointer",
          border: "1.5px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.12)",
          color: "#fff", fontSize: 13, fontWeight: 700,
        }}>
          📍 {location.name}
          <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>⇄ сменить</span>
        </button>

        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: tab === t.id ? "#FFD600" : "rgba(255,255,255,0.12)",
              color: tab === t.id ? "#1a1a1a" : "rgba(255,255,255,0.85)",
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        <button onClick={() => { setAuthed(false); setLocation(null); }} style={{
          padding: "8px 14px", borderRadius: 8, fontFamily: "inherit",
          border: "1.5px solid rgba(255,255,255,0.25)", background: "transparent",
          color: "rgba(255,255,255,0.75)", fontSize: 12, cursor: "pointer", fontWeight: 600,
          flexShrink: 0,
        }}>Выйти</button>
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 24px" }}>
        {tab === "products" && <ProductsTab locationId={location.id} />}
        {tab === "banners"  && <BannersTab  locationId={location.id} />}
        {tab === "orders"   && <OrdersTab   locationId={location.id} />}
      </div>
    </div>
  );
}
