import { useEffect, useState } from "react";
import { Image, Save, X } from "lucide-react";

function lines(value) {
  return (Array.isArray(value) ? value : []).join("\n");
}

function ProductEditModal({ product, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    title: product.title || "",
    description: product.description || "",
    brand: product.brand || "",
    categoryKey: product.categoryKey || "",
    categoryLabel: product.categoryLabel || "",
    imageUrl: product.imageUrl || "",
    images: lines(product.images),
    videoUrl: product.videoUrl || "",
    features: lines(product.features),
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function keydown(event) {
      if (event.key === "Escape" && !isSaving) onClose();
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [isSaving, onClose]);

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      await onSave(product.key, {
        ...form,
        images: form.images.split("\n").map((item) => item.trim()).filter(Boolean),
        features: form.features.split("\n").map((item) => item.trim()).filter(Boolean),
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
      <section className="admin-modal admin-product-edit-modal" role="dialog" aria-modal="true" aria-labelledby="product-edit-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="admin-modal-header">
          <div><p className="admin-eyebrow">ÜRÜN İÇERİĞİ</p><h2 id="product-edit-title">{product.title}</h2><span>{product.key}</span></div>
          <button className="admin-modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Kapat"><X size={20} /></button>
        </header>
        <form className="admin-create-product-form" onSubmit={submit}>
          <div className="admin-form-grid">
            <label className="admin-field admin-field-wide"><span>Ürün adı</span><input name="title" value={form.title} onChange={change} required /></label>
            <label className="admin-field"><span>Kategori anahtarı</span><input name="categoryKey" value={form.categoryKey} onChange={change} required /></label>
            <label className="admin-field"><span>Kategori etiketi</span><input name="categoryLabel" value={form.categoryLabel} onChange={change} /></label>
            <label className="admin-field"><span>Marka</span><input name="brand" value={form.brand} onChange={change} /></label>
            <label className="admin-field"><span>Ana görsel URL</span><div className="admin-input-with-icon"><Image size={17} /><input name="imageUrl" type="url" value={form.imageUrl} onChange={change} /></div></label>
            <label className="admin-field admin-field-wide"><span>Açıklama</span><textarea name="description" rows="5" value={form.description} onChange={change} /></label>
            <label className="admin-field admin-field-wide"><span>Galeri görselleri — her satıra bir URL</span><textarea name="images" rows="4" value={form.images} onChange={change} /></label>
            <label className="admin-field admin-field-wide"><span>Özellikler — her satıra bir özellik</span><textarea name="features" rows="4" value={form.features} onChange={change} /></label>
            <label className="admin-field admin-field-wide"><span>Video URL</span><input name="videoUrl" type="url" value={form.videoUrl} onChange={change} /></label>
          </div>
          {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
          <footer className="admin-modal-actions">
            <button className="admin-secondary-button" type="button" onClick={onClose} disabled={isSaving}>Vazgeç</button>
            <button className="admin-primary-button" type="submit" disabled={isSaving}><Save size={17} /> {isSaving ? "Kaydediliyor..." : "İçeriği kaydet"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default ProductEditModal;
