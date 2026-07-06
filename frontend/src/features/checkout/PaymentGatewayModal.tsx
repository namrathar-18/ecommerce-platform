import { useState } from "react";
import { api } from "../../lib/api";

/**
 * MeshPay — Razorpay-style test gateway sheet (UPI / Card / NetBanking).
 * Everything succeeds in test mode except:
 *   - card 4000 0000 0000 0002  -> declined
 *   - UPI id fail@upi           -> declined
 * A decline cancels the order server-side and releases reserved stock.
 */
type Method = "upi" | "card" | "netbanking";

const BANKS = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra"];

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
  const [method, setMethod] = useState<Method>("upi");
  const [upiId, setUpiId] = useState("");
  const [card, setCard] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [bank, setBank] = useState(BANKS[0]);
  const [phase, setPhase] = useState<"form" | "processing" | "success" | "failed">("form");
  const [error, setError] = useState("");

  const inr = (n: number) => n.toLocaleString("en-IN");

  const validate = (): string | null => {
    if (method === "upi") {
      if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) return "Enter a valid UPI ID (e.g. name@okhdfc)";
    } else if (method === "card") {
      if (card.replace(/\s/g, "").length < 12) return "Enter a valid card number";
      if (!name.trim()) return "Enter the name on the card";
      if (!/^\d{2}\s*\/\s*\d{2}$/.test(expiry)) return "Expiry must be MM/YY";
      if (cvv.length < 3) return "Enter the CVV";
    }
    return null;
  };

  const pay = async () => {
    const v = validate();
    if (v) return setError(v);
    setError("");
    setPhase("processing");

    const declined =
      (method === "card" && card.replace(/\s/g, "") === "4000000000000002") ||
      (method === "upi" && upiId.toLowerCase() === "fail@upi");

    await new Promise((r) => setTimeout(r, 1400)); // visible "contacting bank" state
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

  const TabBtn = ({ id, label, icon }: { id: Method; label: string; icon: string }) => (
    <button
      onClick={() => { setMethod(id); setError(""); }}
      className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium border-b-2 transition-colors ${
        method === id ? "border-indigo-600 text-indigo-600 bg-indigo-50/60" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0f172a] to-[#1e3a8a] text-white px-5 py-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold text-lg tracking-tight">MeshPay</p>
              <p className="text-[11px] text-white/70">ShopMesh Marketplace · Order #{orderId}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">₹{inr(amount)}</p>
              <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider bg-amber-400/90 text-slate-900 px-2 py-0.5 rounded">
                Test mode
              </span>
            </div>
          </div>
        </div>

        {phase === "form" && (
          <>
            <div className="flex border-b">
              <TabBtn id="upi" label="UPI" icon="📱" />
              <TabBtn id="card" label="Card" icon="💳" />
              <TabBtn id="netbanking" label="NetBanking" icon="🏦" />
            </div>

            <div className="p-5 space-y-3">
              {method === "upi" && (
                <>
                  <label className="text-xs text-slate-500">UPI ID</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2.5"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="yourname@okhdfc"
                    autoFocus
                  />
                  <div className="flex gap-2 flex-wrap">
                    {["@okhdfc", "@oksbi", "@ybl", "@paytm"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setUpiId((v) => (v.includes("@") ? v.split("@")[0] : v || "demo") + s)}
                        className="text-[11px] bg-slate-100 hover:bg-slate-200 rounded-full px-2.5 py-1"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">A collect request will be simulated — no app needed in test mode.</p>
                </>
              )}

              {method === "card" && (
                <>
                  <div>
                    <label className="text-xs text-slate-500">Card number</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2.5 font-mono tracking-wider"
                      value={card}
                      onChange={(e) => setCard(e.target.value)}
                      placeholder="4111 1111 1111 1111"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Name on card</label>
                    <input className="w-full border rounded-lg px-3 py-2.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500">Expiry</label>
                      <input className="w-full border rounded-lg px-3 py-2.5" value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="MM/YY" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500">CVV</label>
                      <input className="w-full border rounded-lg px-3 py-2.5" type="password" value={cvv} onChange={(e) => setCvv(e.target.value)} placeholder="•••" />
                    </div>
                  </div>
                </>
              )}

              {method === "netbanking" && (
                <>
                  <label className="text-xs text-slate-500">Choose your bank</label>
                  <div className="grid grid-cols-1 gap-2">
                    {BANKS.map((b) => (
                      <label key={b} className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer ${bank === b ? "border-indigo-500 bg-indigo-50/60" : ""}`}>
                        <input type="radio" checked={bank === b} onChange={() => setBank(b)} />
                        <span className="text-sm">{b}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                onClick={pay}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold rounded-lg py-3 hover:opacity-90"
              >
                Pay ₹{inr(amount)}
              </button>
              <button onClick={onClose} className="w-full text-slate-500 text-sm py-1">Cancel payment</button>
              <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                🔒 256-bit simulated encryption · Test mode: everything succeeds except card
                4000&nbsp;0000&nbsp;0000&nbsp;0002 or UPI <code>fail@upi</code> (simulates a decline).
              </p>
            </div>
          </>
        )}

        {phase === "processing" && (
          <div className="p-12 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-600 text-sm">
              {method === "upi" ? "Waiting for UPI approval…" : method === "netbanking" ? `Redirecting to ${bank}…` : "Contacting bank…"}
            </p>
          </div>
        )}

        {phase === "success" && (
          <div className="p-12 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">✅</div>
            <p className="font-semibold text-emerald-700 text-lg">Payment successful</p>
            <p className="text-slate-500 text-sm">₹{inr(amount)} paid · redirecting to your orders…</p>
          </div>
        )}

        {phase === "failed" && (
          <div className="p-10 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-3xl">❌</div>
            <p className="font-semibold text-red-700 text-lg">Payment declined</p>
            <p className="text-slate-500 text-sm text-center">
              Your bank declined this transaction. The order was cancelled and reserved stock was released.
            </p>
            <button onClick={onClose} className="mt-2 px-6 py-2 bg-slate-900 text-white rounded-lg text-sm">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
