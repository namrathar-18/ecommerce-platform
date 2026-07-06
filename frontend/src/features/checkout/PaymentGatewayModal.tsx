import { useState } from "react";
import { api } from "../../lib/api";

/**
 * Dummy payment gateway — mimics a Razorpay/Stripe card sheet.
 * Any card number works; "4000 0000 0000 0002" simulates a DECLINE
 * (mirrors Stripe's canonical decline test card).
 */
export default function PaymentGatewayModal({
  orderId,
  amount,
  onSuccess,
  onClose,
}: {
  orderId: number;
  amount: number;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [card, setCard] = useState("4111 1111 1111 1111");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("12/28");
  const [cvv, setCvv] = useState("123");
  const [phase, setPhase] = useState<"form" | "processing" | "success" | "failed">("form");
  const [error, setError] = useState("");

  const pay = async () => {
    setError("");
    if (card.replace(/\s/g, "").length < 12) return setError("Enter a valid card number");
    if (!expiry || !cvv) return setError("Enter expiry and CVV");
    setPhase("processing");
    const declined = card.replace(/\s/g, "") === "4000000000000002";
    // small delay so the processing state is visible, like a real gateway
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const res = await api.post("/payments/pay", {
        orderId,
        outcome: declined ? "failed" : "success",
      });
      if (res.data.paymentStatus === "success") {
        setPhase("success");
        setTimeout(onSuccess, 1100);
      } else {
        setPhase("failed");
      }
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? "Payment failed");
      setPhase("form");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        {/* Gateway header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold">MeshPay</p>
              <p className="text-xs text-white/80">Secure Test Gateway</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/80">Order #{orderId}</p>
              <p className="text-xl font-bold">₹{amount.toLocaleString("en-IN")}</p>
            </div>
          </div>
        </div>

        {phase === "form" && (
          <div className="p-5 space-y-3">
            <div>
              <label className="text-xs text-slate-500">Card number</label>
              <input
                className="w-full border rounded-lg px-3 py-2 font-mono tracking-wider"
                value={card}
                onChange={(e) => setCard(e.target.value)}
                placeholder="1234 5678 9012 3456"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Name on card</label>
              <input className="w-full border rounded-lg px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500">Expiry</label>
                <input className="w-full border rounded-lg px-3 py-2" value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="MM/YY" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500">CVV</label>
                <input className="w-full border rounded-lg px-3 py-2" type="password" value={cvv} onChange={(e) => setCvv(e.target.value)} placeholder="•••" />
              </div>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button onClick={pay} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg py-2.5 hover:opacity-90">
              Pay ₹{amount.toLocaleString("en-IN")}
            </button>
            <button onClick={onClose} className="w-full text-slate-500 text-sm py-1">Cancel</button>
            <p className="text-[11px] text-slate-400 text-center">
              Test mode — any card succeeds. Use 4000 0000 0000 0002 to simulate a decline.
            </p>
          </div>
        )}

        {phase === "processing" && (
          <div className="p-10 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-600 text-sm">Contacting bank…</p>
          </div>
        )}

        {phase === "success" && (
          <div className="p-10 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">✅</div>
            <p className="font-semibold text-emerald-700">Payment successful!</p>
            <p className="text-slate-500 text-sm">Redirecting to your orders…</p>
          </div>
        )}

        {phase === "failed" && (
          <div className="p-8 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-3xl">❌</div>
            <p className="font-semibold text-red-700">Payment declined</p>
            <p className="text-slate-500 text-sm text-center">
              The order was cancelled and reserved stock was released — add the items to your cart to try again.
            </p>
            <button onClick={onClose} className="mt-2 px-6 py-2 bg-slate-900 text-white rounded-lg text-sm">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
