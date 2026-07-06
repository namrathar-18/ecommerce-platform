import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import PaymentGatewayModal from "../checkout/PaymentGatewayModal";

export default function CartPage() {
  const [cart, setCart] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [pendingOrder, setPendingOrder] = useState<{ orderId: number; total: number } | null>(null);
  const navigate = useNavigate();

  const load = () => api.get("/cart").then((r) => setCart(r.data));
  useEffect(() => {
    load();
  }, []);

  const setQty = async (productId: number, quantity: number) => {
    const r = await api.patch(`/cart/items/${productId}`, { quantity });
    setCart(r.data);
  };
  const remove = async (productId: number) => {
    const r = await api.delete(`/cart/items/${productId}`);
    setCart(r.data);
  };

  // Step 1: atomic checkout reserves stock and creates a pending order.
  // Step 2: the (dummy) gateway modal captures payment for that order.
  const checkout = async () => {
    setMsg("");
    try {
      const r = await api.post("/orders/checkout", {});
      setPendingOrder({ orderId: r.data.orderId, total: r.data.total });
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? "Checkout failed");
    }
  };

  if (!cart) return <p>Loading...</p>;
  if (cart.lines.length === 0 && !pendingOrder)
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-3">🛒</p>
        <p className="text-slate-500">Your cart is empty — go grab something colorful!</p>
      </div>
    );

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">Your Cart</h1>
      <div className="bg-white border rounded-xl divide-y shadow-sm">
        {cart.lines.map((l: any) => (
          <div key={l.productId} className="flex items-center gap-3 p-3">
            {l.image && <img src={l.image} className="w-14 h-14 object-cover rounded-lg" />}
            <div className="flex-1">
              <p className="font-medium text-sm">{l.name}</p>
              <p className="text-slate-500 text-sm">₹{l.unitPrice} each</p>
              {!l.inStock && <p className="text-red-500 text-xs">Only {l.available} available</p>}
            </div>
            <input
              type="number"
              min={1}
              value={l.quantity}
              onChange={(e) => setQty(l.productId, Number(e.target.value))}
              className="w-16 border rounded px-2 py-1"
            />
            <span className="w-20 text-right font-medium">₹{l.lineTotal}</span>
            <button onClick={() => remove(l.productId)} className="text-red-500 text-sm">✕</button>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mt-4">
        <span className="text-lg font-semibold">Total: ₹{cart.total}</span>
        <button
          onClick={checkout}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90"
        >
          Checkout & Pay
        </button>
      </div>
      {msg && <p className="text-red-600 text-sm mt-2">{msg}</p>}

      {pendingOrder && (
        <PaymentGatewayModal
          orderId={pendingOrder.orderId}
          amount={pendingOrder.total}
          onSuccess={() => navigate("/orders")}
          onClose={async () => {
            // abandoning the gateway: cancel the pending order so reserved stock is released
            try {
              await api.post(`/orders/${pendingOrder.orderId}/cancel`);
            } catch {
              /* already paid/cancelled — nothing to release */
            }
            setPendingOrder(null);
            load();
          }}
        />
      )}
    </div>
  );
}
