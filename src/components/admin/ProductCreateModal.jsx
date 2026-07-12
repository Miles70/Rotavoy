import { useEffect, useState } from "react";
import { Image, PackagePlus, X } from "lucide-react";

const initialForm = {
  key: "",
  title: "",
  categoryKey: "electronics",
  price: "",
  oldPrice: "",
  stock: "100",
  badge: "",
  image: "🛍️",
  imageUrl: "",
  isActive: true,
};

function slugify(value) {
  const replacements = {
    ç: "c",
    ğ: "g",
    ı: "i",
    ö: "o",
    ş: "s",
    ü: "u",
  };

  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[çğıöşü]/g, (letter) => replacements[letter] || letter)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ProductCreateModal({ onClose, onCreate }) {
  const [form, setForm] = useState(initialForm);
  const [keyTouched, setKeyTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "title" && !keyTouched) {
        next.key = slugify(value);
      }
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      await onCreate({
        ...form,
        price: Number(form.price),
        oldPrice: form.oldPrice === "" ? null : Number(form.oldPrice),
        stock: Number(form.stock),
        badge: form.badge || null,
      });
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={isSaving ? undefined : onClose}>
      <section
        className="admin-modal admin-product-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-create-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="admin-modal-header">
          <div>
            <p className="admin-eyebrow">KATALOĞA EKLE</p>
            <h2 id="product-create-title">Yeni ürün</h2>
          </div>
          <button className="admin-modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Kapat">
            <X size={20} />
          </button>
        </header>

        <form className="admin-create-product-form" onSubmit={handleSubmit}>
          <div className="admin-form-grid">
            <label className="admin-field admin-field-wide">
              <span>Ürün adı</span>
              <input
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="Örn. Wireless Gaming Headset"
                required
              />
            </label>

            <label className="admin-field">
              <span>Ürün anahtarı</span>
              <input
                value={form.key}
                onChange={(event) => {
                  setKeyTouched(true);
                  updateField("key", slugify(event.target.value));
                }}
                placeholder="wireless-gaming-headset"
                required
              />
            </label>

            <label className="admin-field">
              <span>Kategori</span>
              <input
                list="admin-product-categories"
                value={form.categoryKey}
                onChange={(event) => updateField("categoryKey", slugify(event.target.value))}
                required
              />
              <datalist id="admin-product-categories">
                <option value="electronics" />
                <option value="fashion" />
                <option value="home" />
                <option value="gaming" />
              </datalist>
            </label>

            <label className="admin-field">
              <span>Fiyat (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => updateField("price", event.target.value)}
                placeholder="49.99"
                required
              />
            </label>

            <label className="admin-field">
              <span>Eski fiyat</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.oldPrice}
                onChange={(event) => updateField("oldPrice", event.target.value)}
                placeholder="Boş bırakılabilir"
              />
            </label>

            <label className="admin-field">
              <span>Stok</span>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(event) => updateField("stock", event.target.value)}
                required
              />
            </label>

            <label className="admin-field">
              <span>Rozet</span>
              <select value={form.badge} onChange={(event) => updateField("badge", event.target.value)}>
                <option value="">Yok</option>
                <option value="sale">sale</option>
                <option value="new">new</option>
                <option value="stock">stock</option>
              </select>
            </label>

            <label className="admin-field">
              <span>Emoji</span>
              <input
                value={form.image}
                onChange={(event) => updateField("image", event.target.value)}
                maxLength="8"
                placeholder="🛍️"
              />
            </label>

            <label className="admin-field admin-field-wide">
              <span>Görsel URL</span>
              <div className="admin-input-with-icon">
                <Image size={17} />
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(event) => updateField("imageUrl", event.target.value)}
                  placeholder="https://..."
                />
              </div>
            </label>
          </div>

          <label className="admin-create-active-row">
            <span>
              <strong>Ürünü hemen yayınla</strong>
              <small>Kapalı olursa ürün katalogda kayıtlı kalır fakat mağazada görünmez.</small>
            </span>
            <span className="admin-switch">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => updateField("isActive", event.target.checked)}
              />
              <span />
            </span>
          </label>

          {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}

          <footer className="admin-modal-actions">
            <button className="admin-secondary-button" type="button" onClick={onClose} disabled={isSaving}>
              Vazgeç
            </button>
            <button className="admin-primary-button" type="submit" disabled={isSaving}>
              <PackagePlus size={18} /> {isSaving ? "Ekleniyor..." : "Ürünü ekle"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default ProductCreateModal;
