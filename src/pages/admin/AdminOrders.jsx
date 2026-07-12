import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, Search, ShoppingCart } from "lucide-react";
import OrderDetailsModal from "../../components/admin/OrderDetailsModal";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { getAdminOrders, updateAdminOrder } from "../../services/adminApi";

const orderStatusOptions = ["pending", "processing", "shipped", "completed", "cancelled"];
const paymentStatusOptions = ["unpaid", "pending", "paid", "failed", "refunded"];

function formatMoney(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function AdminOrders() {
  const { token } = useAdminAuth();
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrder, setUpdatingOrder] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const data = await getAdminOrders(token, statusFilter);
      setOrders(data.orders || []);
      setSelectedOrder((current) => {
        if (!current) return null;
        return (data.orders || []).find((order) => order.orderNumber === current.orderNumber) || null;
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((order) =>
      [
        order.orderNumber,
        order.customer?.fullName,
        order.customer?.email,
        order.customer?.phone,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [orders, search]);

  async function handleUpdate(orderNumber, field, value) {
    setUpdatingOrder(orderNumber);
    setError("");

    try {
      const data = await updateAdminOrder(token, orderNumber, { [field]: value });
      setOrders((current) =>
        current.map((order) => (order.orderNumber === orderNumber ? data.order : order))
      );
      setSelectedOrder((current) =>
        current?.orderNumber === orderNumber ? data.order : current
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingOrder("");
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">OPERASYON</p>
          <h1>Siparişler</h1>
          <p>Müşteriyi, ödemeyi ve teslimat akışını buradan yönet.</p>
        </div>
        <button className="admin-secondary-button" type="button" onClick={loadOrders} disabled={isLoading}>
          <RefreshCw size={18} className={isLoading ? "is-spinning" : ""} /> Yenile
        </button>
      </div>

      <section className="admin-toolbar">
        <label className="admin-search-box">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Sipariş no, müşteri, e-posta ara..."
          />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Tüm siparişler</option>
          {orderStatusOptions.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </section>

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">KAYITLAR</p>
            <h2>{visibleOrders.length} sipariş</h2>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table admin-orders-table">
            <thead>
              <tr>
                <th>Sipariş</th>
                <th>Müşteri</th>
                <th>Ürün</th>
                <th>Tutar</th>
                <th>Sipariş durumu</th>
                <th>Ödeme</th>
                <th>Tarih</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && visibleOrders.length ? (
                visibleOrders.map((order) => (
                  <tr key={order.orderNumber}>
                    <td><strong>#{order.orderNumber}</strong></td>
                    <td>
                      <div className="admin-customer-cell">
                        <strong>{order.customer?.fullName}</strong>
                        <span>{order.customer?.email}</span>
                        <span>{order.customer?.phone}</span>
                      </div>
                    </td>
                    <td>{order.items?.reduce((total, item) => total + item.quantity, 0) || 0} adet</td>
                    <td><strong>{formatMoney(order.total, order.currency)}</strong></td>
                    <td>
                      <select
                        className={`admin-inline-select admin-status-select-${order.status}`}
                        value={order.status}
                        disabled={updatingOrder === order.orderNumber}
                        onChange={(event) => handleUpdate(order.orderNumber, "status", event.target.value)}
                      >
                        {orderStatusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className={`admin-inline-select admin-payment-select-${order.paymentStatus}`}
                        value={order.paymentStatus}
                        disabled={updatingOrder === order.orderNumber}
                        onChange={(event) => handleUpdate(order.orderNumber, "paymentStatus", event.target.value)}
                      >
                        {paymentStatusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <button
                        className="admin-detail-button"
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        aria-label={`#${order.orderNumber} siparişini aç`}
                      >
                        <Eye size={16} /> Detay
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8">
                    <div className="admin-empty-state">
                      <ShoppingCart size={24} />
                      {isLoading ? "Siparişler yükleniyor..." : "Bu filtrede sipariş bulunamadı."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedOrder ? (
        <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      ) : null}
    </div>
  );
}

export default AdminOrders;
