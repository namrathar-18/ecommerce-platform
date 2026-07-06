import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [activeImg, setActiveImg] = useState(0);
  const [msg, setMsg] = useState("");
  const user = useAppSelector((s) => s.auth.user);

  useEffect(() => {
    setActiveImg(0);
    api.get(`/products/${id}`).then((r) => setProduct(r.data));
    api.get(`/products/${id}/recommendations`).then((r) => setRecs(r.data)).catch(() => {});
    api.get(`/products/${id}/reviews`).then((r) => setReviews(r.data)).catch(() => {});
  }, [id]);

  if (!product) return <p>Loading...</p>;
  const available = product.inventory ? product.inventory.quantity - product.inventory.reservedQuantity : 0;
  const images: any[] = product.images ?? [];

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
      <div className="grid md:grid-cols-2 gap-8 bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <div className="bg-slate-50 rounded-xl flex items-center justify-center h-80 overflow-hidden">
            <img
              src={images[activeImg]?.imageUrl}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImg(i)}
                  className={`w-16 h-16 rounded-lg border-2 overflow-hidden bg-slate-50 ${i === activeImg ? "border-indigo-500" : "border-transparent"}`}
                >
                  <img src={img.imageUrl} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-500 font-semibold">{product.category?.name}</p>
          <h1 className="text-2xl font-bold mt-1">{product.name}</h1>
          <p className="text-slate-500 text-sm">
            Sold by <span className="font-medium text-slate-700">{product.vendor?.storeName}</span>
          </p>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-slate-900">
              ₹{Number(product.discountPrice ?? product.price).toLocaleString("en-IN")}
            </span>
            {product.discountPrice && (
              <span className="line-through text-slate-400">₹{Number(product.price).toLocaleString("en-IN")}</span>
            )}
          </div>
          {product.ratingCount > 0 && (
            <p className="text-sm mt-2">
              <span className="bg-emerald-600 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                ★ {Number(product.ratingAvg).toFixed(1)}
              </span>{" "}
              <span className="text-slate-500">{product.ratingCount} rating(s)</span>
            </p>
          )}
          <p className="mt-4 text-slate-700 leading-relaxed">{product.description ?? "No description."}</p>
          <p className={`mt-3 text-sm font-medium ${available > 0 ? "text-emerald-600" : "text-red-500"}`}>
            {available > 0 ? `✔ ${available} in stock` : "✖ Out of stock"}
          </p>
          {(!user || user.role === "customer") && (
            <button
              onClick={add}
              disabled={available <= 0}
              className="mt-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold disabled:opacity-40 hover:opacity-90"
            >
              Add to cart
            </button>
          )}
          {msg && <p className="text-sm text-emerald-600 mt-2">{msg}</p>}
        </div>
      </div>

      {reviews.length > 0 && (
        <div className="mt-6 bg-white border rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Customer reviews</h2>
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="border-b last:border-0 pb-3">
                <p className="text-sm">
                  <span className="bg-emerald-600 text-white text-xs font-bold px-1.5 py-0.5 rounded">★ {r.rating}</span>{" "}
                  <span className="font-medium">{r.user?.name}</span>
                </p>
                {r.comment && <p className="text-sm text-slate-600 mt-1">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {recs.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold mb-2">Customers also bought</h2>
          <div className="flex gap-3 flex-wrap">
            {recs.map((r) => (
              <Link
                key={r.productId}
                to={`/products/${r.productId}`}
                className="bg-white border rounded-xl px-4 py-2.5 text-sm hover:border-indigo-400 shadow-sm"
              >
                {r.name} <span className="text-slate-400">· bought together ×{r.coPurchaseCount}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
