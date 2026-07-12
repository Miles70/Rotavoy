import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  ShoppingCart,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { getAdminAnalytics, getAdminDashboard } from "../../services/adminApi";

function formatMoney(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDay(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "short",
  }).format(new Date(`${value}T12:00:00Z`));
}

function AdminDashboard() {
  const { token } = useAdminAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    setIsLoading(true);
    Promise.all([getAdminDashboard(token), getAdminAnalytics(token)])
      .then(([dashboard, analytics]) => {
        if (!isCancelled) {
          setData({ ...dashboard, analytics });
          setError("");
        }
      })
      .catch((requestError) => {
        if (!isCancelled) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [token]);

  const summary = data?.summary;
  const primaryRevenue = summary?.revenueByCurrency?.[0];
  const orderTrend = data?.analytics?.orderTrend || [];
  const statusBreakdown = data?.analytics?.statusBreakdown || [];
  const maxOrders = Math.max(1, ...orderTrend.map((item) => item.orders));
  const maxStatusCount = Math.max(1, ...statusBreakdown.map((item) => item.count));
  const cards = [
    {
      label: "Toplam sipariş",
      value: summary?.totalOrders ?? 0,
      detail: `${summary?.pendingOrders ?? 0} işlem bekliyor`,
      icon: ShoppingCart,
    },
    {
      label: "Ödenen gelir",
      value: primaryRevenue ? formatMoney(primaryRevenue.total, primaryRevenue.currency) : "$0.00",
      detail: primaryRevenue ? `${primaryRevenue.count} ödenmiş sipariş` : "Henüz ödeme yok",
      icon: CircleDollarSign,
    },
    {
      label: "Aktif ürün",
      value: summary?.activeProducts ?? 0,
      detail: `${summary?.totalProducts ?? 0} toplam ürün`,
      icon: PackageCheck,
    },
    {
      label: "Düşük stok",
      value: summary?.lowStockProducts ?? 0,
      detail: "10 adet ve altı",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">GENEL BAKIŞ</p>
          <h1>Dashboard</h1>
          <p>Mağazanın nabzı burada. Ne oluyor, ne bekliyor, nerede aksiyon lazım tek bakışta gör.</p>
        </div>
        <div className="admin-heading-actions">
          <Link className="admin-secondary-button" to="/admin/products">
            <Boxes size={18} /> Ürünleri yönet
          </Link>
          <Link className="admin-primary-button" to="/admin/orders">
            <ShoppingCart size={18} /> Siparişlere git
          </Link>
        </div>
      </div>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}

      <section className="admin-stat-grid" aria-busy={isLoading}>
        {cards.map(({ label, value, detail, icon: Icon }) => (
          <article className="admin-stat-card" key={label}>
            <div className="admin-stat-icon"><Icon size={22} /></div>
            <span>{label}</span>
            <strong>{isLoading ? "—" : value}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </section>

      <section className="admin-chart-grid" aria-busy={isLoading}>
        <article className="admin-panel admin-chart-card">
          <div className="admin-panel-header">
            <div>
              <p className="admin-eyebrow">7 GÜNLÜK TREND</p>
              <h2>Sipariş hareketi</h2>
            </div>
            <BarChart3 size={20} />
          </div>

          <div className="admin-bar-chart">
            {orderTrend.map((item) => {
              const height = item.orders ? Math.max(12, (item.orders / maxOrders) * 100) : 4;
              return (
                <div className="admin-bar-column" key={item.date}>
                  <strong>{item.orders}</strong>
                  <div className="admin-bar-track" title={`${item.orders} sipariş`}>
                    <span style={{ height: `${height}%` }} />
                  </div>
                  <b>{formatDay(item.date)}</b>
                  <small>{formatMoney(item.paidRevenue)}</small>
                </div>
              );
            })}
          </div>
        </article>

        <article className="admin-panel admin-chart-card">
          <div className="admin-panel-header">
            <div>
              <p className="admin-eyebrow">DAĞILIM</p>
              <h2>Sipariş durumları</h2>
            </div>
            <Activity size={20} />
          </div>

          <div className="admin-status-chart">
            {statusBreakdown.map((item) => (
              <div className="admin-status-chart-row" key={item.status}>
                <div>
                  <span className={`admin-status admin-status-${item.status}`}>{item.status}</span>
                  <strong>{item.count}</strong>
                </div>
                <div className="admin-status-chart-track">
                  <span
                    className={`admin-status-chart-fill admin-status-chart-fill-${item.status}`}
                    style={{ width: `${(item.count / maxStatusCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">SON HAREKETLER</p>
            <h2>Son siparişler</h2>
          </div>
          <Link to="/admin/orders">Tümünü gör</Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sipariş</th>
                <th>Müşteri</th>
                <th>Tutar</th>
                <th>Durum</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && data?.recentOrders?.length ? (
                data.recentOrders.map((order) => (
                  <tr key={order.orderNumber}>
                    <td><strong>#{order.orderNumber}</strong></td>
                    <td>
                      <div className="admin-customer-cell">
                        <strong>{order.customer?.fullName}</strong>
                        <span>{order.customer?.email}</span>
                      </div>
                    </td>
                    <td>{formatMoney(order.total, order.currency)}</td>
                    <td><span className={`admin-status admin-status-${order.status}`}>{order.status}</span></td>
                    <td>{formatDate(order.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">
                    <div className="admin-empty-state">
                      <Clock3 size={23} />
                      {isLoading ? "Siparişler yükleniyor..." : "Henüz sipariş bulunmuyor."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;
