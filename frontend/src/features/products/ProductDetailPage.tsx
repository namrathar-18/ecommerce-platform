import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const user = useAppSelector((s) => s.auth.user);

  useEffect(() => {
    api.get(`/products/${id}`).then((r) => setProduct(r.data));
    api.get(`/products/${id}/recommendations`).then((r) => setRecs(r.data)).catch(() => {});
  }, [id]);

  if (!product) return <p>Loading...</p>;
  const available = product.inventory ? product.inventory.quantity - product.inventory.reservedQuantity : 0;

  const add = async () => {
    try {
      await api.post("/cart/items", { productId: Number(id), quantity: 1 });
      setMsg("Added to cart ✓");
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? "Login as a customer");
    }
  };

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-6 bg-white p-6 rounded-lg border">
        <img src={product.images[0]?.imageUrl} className="w-full h-64 object-cover rounded" />
        <div>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="text-slate-500 text-sm">Sold by {product.vendor?.storeName}</p>
          <p className="mt-3 text-xl font-bold">₹{product.discountPrice ?? product.price}</p>
          {product.ratingCount > 0 && (
            <p className="text-sm text-amber-600 mt-1">
              ★ {Number(product.ratingAvg).toFixed(1)} ({product.ratingCount})
            </p>
          )}
          <p className="mt-3 text-slate-700">{product.description ?? "No description."}</p>
          <p className={`mt-2 text-sm ${available > 0 ? "text-emerald-600" : "text-red-500"}`}>
            {available > 0 ? `${available} in stock` : "Out of stock"}
          </p>
          {(!user || user.role === "customer") && (
            <button onClick={add} disabled={available <= 0} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded disabled:opacity-40">
              Add to cart
            </button>
          )}
          {msg && <p className="text-sm text-emerald-600 mt-2">{msg}</p>}
        </div>
      </div>

      {recs.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold mb-2">Customers also bought</h2>
          <div className="flex gap-3 flex-wrap">
            {recs.map((r) => (
              <Link key={r.productId} to={`/products/${r.productId}`} className="bg-white border rounded px-3 py-2 text-sm hover:border-indigo-400">
                {r.name} <span className="text-slate-400">×{r.coPurchaseCount}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
