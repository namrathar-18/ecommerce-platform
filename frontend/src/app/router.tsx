import { createBrowserRouter } from "react-router-dom";
import Layout from "../components/Layout";
import ProtectedRoute from "../components/ProtectedRoute";
import ProductsPage from "../features/products/ProductsPage";
import ProductDetailPage from "../features/products/ProductDetailPage";
import LoginPage from "../features/auth/LoginPage";
import RegisterPage from "../features/auth/RegisterPage";
import CartPage from "../features/cart/CartPage";
import OrdersPage from "../features/orders/OrdersPage";
import VendorDashboard from "../features/vendor/VendorDashboard";
import AdminDashboard from "../features/admin/AdminDashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <ProductsPage /> },
      { path: "products/:id", element: <ProductDetailPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        path: "cart",
        element: (
          <ProtectedRoute roles={["customer"]}>
            <CartPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "orders",
        element: (
          <ProtectedRoute roles={["customer"]}>
            <OrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "vendor",
        element: (
          <ProtectedRoute roles={["vendor"]}>
            <VendorDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute roles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
