import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";
import Hero3D from "../../components/Hero3D";

interface Product {
  id: number;
  name: string;
  price: string;
  discountPrice: string | null;
  images: { imageUrl: string }[];
  inventory: { quantity: number; reservedQuantity: number } | null;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [toast, setToast] = useState("");
  const user = useAppSelector((s) => s.auth.user);

  const load = async () => {
    const res = await api.get("/products", { params: { q: q || undefined, sort, limit: 24 } });
    setProducts(res.data.items);
    setCursor(res.data.nextCursor);
  };
  const loadMore = async () => {
    if (!cursor) return;
    const res = await api.get("/products", {
      params: { q: q || undefined, sort, limit: 24, cursor },
    });
    setProducts((p) => [...p, ...res.data.items]);
    setCursor(res.data.nextCursor);
  };
  useEffect(() => {
    load();
  }, [sort]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };

  const addToCart = async (id: number) => {
    try {
      await api.post("/cart/items", { productId: id, quantity: 1 });
      flash("Added to cart ✓");
    } catch (e: any) {
      flash(e.response?.data?.error?.message ?? "Login as a customer to add to cart");
    }
  };

  return (
    <div>
      <Hero3D />

      <div className="flex gap-3 mb-5">
        <input
          className="border-2 border-transparent focus:border-indigo-400 outline-none rounded-xl px-4 py-2.5 flex-1 bg-white shadow-sm"
          placeholder="🔍  Search products..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <select className="border-0 rounded-xl px-3 py-2 bg-white shadow-sm" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
        <button onClick={load} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 rounded-xl font-medium hover:opacity-90">
          Search
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {products.map((p, idx) => {
          const inStock = p.inventory ? p.inventory.quantity - p.inventory.reservedQuantity > 0 : false;
          const pct =
            p.discountPrice != null
              ? Math.round((1 - Number(p.discountPrice) / Number(p.price)) * 100)
              : 0;
          return (
            <div
              key={p.id}
              className="group bg-white rounded-2xl border border-slate-100 p-3 flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <Link to={`/products/${p.id}`} className="relative">
                {pct > 0 && (
                  <span className="absolute top-2 left-2 z-[1] bg-gradient-to-r from-rose-500 to-orange-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    -{pct}%
                  </span>
                )}
                <div className="w-full h-36 bg-slate-50 rounded-xl mb-2 overflow-hidden flex items-center justify-center">
                  <img
                    src={p.images[0]?.imageUrl}
                    alt={p.name}
                    className="max-h-full max-w-full object-contain group-hover:scale-[1.05] transition-transform duration-300"
                  />
                </div>
                <h3 className="font-semibold text-sm text-slate-800">{p.name}</h3>
              </Link>
              <div className="mt-1 text-sm">
                {p.discountPrice ? (
                  <>
                    <span className="font-bold text-indigo-600">₹{p.discountPrice}</span>{" "}
                    <span className="line-through text-slate-400 text-xs">₹{p.price}</span>
                  </>
                ) : (
                  <span className="font-bold text-indigo-600">₹{p.price}</span>
                )}
              </div>
              <span className={`text-xs mt-0.5 ${inStock ? "text-emerald-600" : "text-red-500"}`}>
                {inStock ? "● In stock" : "● Out of stock"}
              </span>
              {(!user || user.role === "customer") && (
                <button
                  disabled={!inStock}
                  onClick={() => addToCart(p.id)}
                  className="mt-2 text-sm bg-slate-900 text-white rounded-lg py-1.5 font-medium disabled:opacity-30 hover:bg-indigo-600 transition-colors"
                >
                  Add to cart
                </button>
              )}
            </div>
          );
        })}
      </div>

      {cursor && (
        <div className="flex justify-center mt-8">
          <button
            onClick={loadMore}
            className="px-8 py-2.5 rounded-xl bg-white border shadow-sm font-medium hover:border-indigo-400"
          >
            Load more products
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
