import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAppDispatch } from "../../app/hooks";
import { setCredentials } from "./authSlice";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "customer", storeName: "" });
  const [error, setError] = useState("");
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const payload: any = { ...form };
      if (form.role !== "vendor") delete payload.storeName;
      const res = await api.post("/auth/register", payload);
      dispatch(setCredentials(res.data));
      navigate(form.role === "vendor" ? "/vendor" : "/");
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Registration failed");
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10 bg-white p-6 rounded-lg border">
      <h1 className="text-xl font-semibold mb-4">Create account</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => set("name", e.target.value)} />
        <input className="w-full border rounded px-3 py-2" placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        <input className="w-full border rounded px-3 py-2" type="password" placeholder="Password (min 8)" value={form.password} onChange={(e) => set("password", e.target.value)} />
        <select className="w-full border rounded px-3 py-2" value={form.role} onChange={(e) => set("role", e.target.value)}>
          <option value="customer">Customer</option>
          <option value="vendor">Vendor</option>
        </select>
        {form.role === "vendor" && (
          <input className="w-full border rounded px-3 py-2" placeholder="Store name" value={form.storeName} onChange={(e) => set("storeName", e.target.value)} />
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full bg-indigo-600 text-white rounded py-2">Register</button>
      </form>
      <p className="mt-4 text-sm">
        Have an account?{" "}
        <Link to="/login" className="text-indigo-600 underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
