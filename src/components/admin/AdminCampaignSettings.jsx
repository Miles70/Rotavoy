import { useEffect, useState } from "react";
import { Megaphone, Save } from "lucide-react";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { getAdminCampaign, updateAdminCampaign } from "../../services/adminApi";

const emptyForm = {
  active: true,
  eyebrow: "",
  title: "",
  description: "",
  buttonLabel: "",
  buttonUrl: "/products",
  backgroundImageUrl: "",
  productKeys: "",
  startsAt: "",
  endsAt: "",
};

function localDate(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function AdminCampaignSettings() {
  const { token } = useAdminAuth();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getAdminCampaign(token)
      .then(({ campaign }) => {
        if (!campaign) return;
        setForm({
          active: Boolean(campaign.active),
          eyebrow: campaign.eyebrow || "",
          title: campaign.title || "",
          description: campaign.description || "",
          buttonLabel: campaign.buttonLabel || "",
          buttonUrl: campaign.buttonUrl || "/products",
          backgroundImageUrl: campaign.backgroundImageUrl || "",
          productKeys: (campaign.productKeys || []).join(", "),
          startsAt: localDate(campaign.startsAt),
          endsAt: localDate(campaign.endsAt),
        });
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setBusy(false));
  }, [token]);

  function change(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setMessage("");
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      await updateAdminCampaign(token, {
        ...form,
        productKeys: form.productKeys.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3),
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      });
      setMessage("Kampanya kaydedildi.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const fields = [
    ["eyebrow", "Üst etiket"],
    ["buttonLabel", "Buton yazısı"],
    ["title", "Başlık", "wide"],
    ["buttonUrl", "Buton bağlantısı"],
    ["backgroundImageUrl", "Arka plan görsel URL"],
    ["productKeys", "Ürün anahtarları — virgülle, en fazla 3", "wide"],
  ];

  return (
    <section className="admin-panel admin-campaign-panel">
      <div className="admin-campaign-heading">
        <div className="admin-campaign-title">
          <span className="admin-settings-icon"><Megaphone size={22} /></span>
          <div><p className="admin-eyebrow">VİTRİN</p><h2>Ana sayfa kampanyası</h2><p>Header altındaki reklam alanını yönet.</p></div>
        </div>
        <label className="admin-campaign-toggle"><input type="checkbox" name="active" checked={form.active} onChange={change} /><span>{form.active ? "Yayında" : "Kapalı"}</span></label>
      </div>

      {message ? <div className="admin-alert">{message}</div> : null}

      <form className="admin-campaign-form" onSubmit={save}>
        {fields.map(([name, label, width]) => (
          <label className={width === "wide" ? "admin-campaign-field-wide" : ""} key={name}>
            <span>{label}</span><input name={name} value={form[name]} onChange={change} disabled={busy} />
          </label>
        ))}

        <label className="admin-campaign-field-wide"><span>Açıklama</span><textarea name="description" value={form.description} onChange={change} rows="3" disabled={busy} /></label>
        <label><span>Başlangıç</span><input type="datetime-local" name="startsAt" value={form.startsAt} onChange={change} disabled={busy} /></label>
        <label><span>Bitiş</span><input type="datetime-local" name="endsAt" value={form.endsAt} onChange={change} disabled={busy} /></label>
        <div className="admin-campaign-actions admin-campaign-field-wide"><small>Ürün alanını boş bırakırsan popüler ürünler otomatik seçilir.</small><button className="admin-primary-button" type="submit" disabled={busy}><Save size={17} />{busy ? "Kaydediliyor..." : "Kaydet"}</button></div>
      </form>
    </section>
  );
}

export default AdminCampaignSettings;
