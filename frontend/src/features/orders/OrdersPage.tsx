import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-slate-100 text-slate-600",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);

  const load = () => api.get("/orders").then((r) => setOrders(r.data));
  useEffect(() => {
    load();
  }, []);

  const cancel = async (id: number) => {
    await api.post(`/orders/${id}/cancel`);
    load();
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">My Orders</h1>
      {orders.length === 0 && <p className="text-slate-500">No orders yet.</p>}
      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="bg-white border rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium">Order #{o.id}</span>
                <span className={`ml-3 text-xs px-2 py-0.5 rounded ${statusColor[o.status]}`}>{o.status}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">₹{o.totalAmount}</span>
                {["pending", "confirmed"].includes(o.status) && (
                  <button onClick={() => cancel(o.id)} className="text-red-500 text-sm">
                    Cancel
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-500">
              {o.items.length} item(s) · {o.payment?.paymentStatus ?? "no payment"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
