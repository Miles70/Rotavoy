import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Database, KeyRound, RefreshCw, Server, ShieldCheck, XCircle } from "lucide-react";
import AdminCampaignSettings from "../../components/admin/AdminCampaignSettings";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { getAdminSystemStatus } from "../../services/adminApi";

function Status({ ok, children }) {
  return <span className={`admin-system-state ${ok ? "is-ok" : "is-error"}`}>{ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{children}</span>;
}

function AdminSettings() {
  const { admin, token } = useAdminAuth();
  const [system, setSystem] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSystem(await getAdminSystemStatus(token));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div><p className="admin-eyebrow">SİSTEM</p><h1>Ayarlar ve sistem durumu</h1><p>Admin erişimini, canlı bağlantıları ve mağaza kampanyalarını yönet.</p></div>
        <button className="admin-secondary-button" type="button" onClick={loadStatus} disabled={loading}><RefreshCw size={18} className={loading ? "is-spinning" : ""} /> Durumu yenile</button>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}

      <div className="admin-settings-grid">
        <section className="admin-panel admin-settings-card">
          <div className="admin-settings-icon"><ShieldCheck size={22} /></div>
          <div><h2>Aktif yönetici</h2><p>{admin?.email || "—"}</p><span>Oturum 12 saat geçerli; çıkışta sunucudaki anahtar da iptal edilir.</span></div>
        </section>
        <section className="admin-panel admin-settings-card">
          <div className="admin-settings-icon"><Server size={22} /></div>
          <div><h2>API</h2><Status ok={Boolean(system?.api?.ok)}>{system?.api?.ok ? "Çalışıyor" : "Bağlantı yok"}</Status><span>{system ? `Çalışma süresi: ${Math.floor(system.api.uptimeSeconds / 60)} dakika` : "Kontrol ediliyor..."}</span></div>
        </section>
        <section className="admin-panel admin-settings-card">
          <div className="admin-settings-icon"><Database size={22} /></div>
          <div><h2>MongoDB</h2><Status ok={Boolean(system?.database?.connected)}>{system?.database?.connected ? "Bağlı" : "Bağlı değil"}</Status><span>{system?.database?.name || "Veritabanı adı alınamadı"} · {system?.catalog?.products ?? 0} ürün · {system?.commerce?.orders ?? 0} sipariş</span></div>
        </section>
        <section className="admin-panel admin-settings-card">
          <div className="admin-settings-icon"><KeyRound size={22} /></div>
          <div><h2>Entegrasyonlar</h2><div className="admin-integration-states"><Status ok={Boolean(system?.configuration?.adminAuth)}>Admin</Status><Status ok={Boolean(system?.configuration?.cj)}>CJ API</Status><Status ok={Boolean(system?.configuration?.crypto)}>Kripto ödeme</Status></div><span>Yalnızca yapılandırma durumu gösterilir; gizli anahtarlar tarayıcıya gönderilmez.</span></div>
        </section>
      </div>

      <AdminCampaignSettings />
    </div>
  );
}

export default AdminSettings;
