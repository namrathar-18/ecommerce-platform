import { Navigate } from "react-router-dom";
import { useAppSelector } from "../app/hooks";

export default function ProtectedRoute({
  roles,
  children,
}: {
  roles?: Array<"customer" | "vendor" | "admin">;
  children: JSX.Element;
}) {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
