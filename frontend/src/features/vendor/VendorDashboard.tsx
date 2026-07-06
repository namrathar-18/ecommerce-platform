import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function VendorDashboard() {
  const [items, setItems] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", price: "", sku: "", quantity: "", imageUrl: "" });
  const [msg, setMsg] = useState("");

  const load = () => {
    api.get("/vendor/orders").then((r) => setItems(r.data));
    api.get("/vendor/payouts").then((r) => setPayouts(r.data));
  };
  useEffect(() => {
    load();
  }, []);

  const advance = async (itemId: number, status: string) => {
    await api.patch(`/vendor/orders/${itemId}/status`, { status });
    load();
  };

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.post("/products", {
        name: form.name,
        price: Number(form.price),
        sku: form.sku,
        quantity: Number(form.quantity || 0),
        imageUrl: form.imageUrl || undefined,
      });
      setMsg("Product created ✓");
      setForm({ name: "", price: "", sku: "", quantity: "", imageUrl: "" });
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? "Failed");
    }
  };

  const next: Record<string, string> = { pending: "confirmed", confirmed: "shipped", shipped: "delivered" };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h2 className="font-semibold mb-3">My Sub-Orders</h2>
        <div className="bg-white border rounded-lg divide-y">
          {items.length === 0 && <p className="p-3 text-slate-500 text-sm">No orders yet.</p>}
          {items.map((it) => (
            <div key={it.id} className="p-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{it.product.name}</p>
                <p className="text-slate-500">×{it.quantity} · ₹{it.priceAtPurchase} · {it.itemStatus}</p>
              </div>
              {next[it.itemStatus] && (
                <button onClick={() => advance(it.id, next[it.itemStatus])} className="bg-indigo-600 text-white px-3 py-1 rounded">
                  Mark {next[it.itemStatus]}
                </button>
              )}
            </div>
          ))}
        </div>

        <h2 className="font-semibold mt-6 mb-3">Payouts</h2>
        <div className="bg-white border rounded-lg divide-y text-sm">
          {payouts.length === 0 && <p className="p-3 text-slate-500">No payouts yet.</p>}
          {payouts.map((p) => (
            <div key={p.id} className="p-3 flex justify-between">
              <span>Item #{p.orderItemId}</span>
              <span>₹{p.amount} · {p.payoutStatus}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Add Product</h2>
        <form onSubmit={createProduct} className="bg-white border rounded-lg p-4 space-y-3">
          <input className="w-full border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="w-full border rounded px-3 py-2" placeholder="Price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input className="w-full border rounded px-3 py-2" placeholder="SKU (unique)" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <input className="w-full border rounded px-3 py-2" placeholder="Quantity" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <input className="w-full border rounded px-3 py-2" placeholder="Image URL (optional)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          <button className="w-full bg-emerald-600 text-white rounded py-2">Create</button>
          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        </form>
      </div>
    </div>
  );
}
