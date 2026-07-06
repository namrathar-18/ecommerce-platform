import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAppDispatch } from "../../app/hooks";
import { setCredentials } from "./authSlice";

const DEMO = [
  ["admin@shop.dev", "Admin"],
  ["ravi@shop.dev", "Vendor"],
  ["asha@shop.dev", "Customer"],
];

export default function LoginPage() {
  const [email, setEmail] = useState("asha@shop.dev");
  const [password, setPassword] = useState("Password123");
  const [error, setError] = useState("");
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/auth/login", { email, password });
      dispatch(setCredentials(res.data));
      const role = res.data.user.role;
      navigate(role === "vendor" ? "/vendor" : role === "admin" ? "/admin" : "/");
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Login failed");
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10 bg-white p-6 rounded-lg border">
      <h1 className="text-xl font-semibold mb-4">Sign in</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border rounded px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="w-full border rounded px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full bg-indigo-600 text-white rounded py-2">Sign in</button>
      </form>
      <div className="mt-4 text-xs text-slate-500">
        <p className="mb-1">Demo accounts (password: Password123):</p>
        {DEMO.map(([em, label]) => (
          <button key={em} onClick={() => setEmail(em)} className="mr-2 underline">
            {label}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm">
        No account?{" "}
        <Link to="/register" className="text-indigo-600 underline">
          Register
        </Link>
      </p>
    </div>
  );
}
