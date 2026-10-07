// src/components/AdminRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Guard for admin‑only pages.
 * If the logged‑in user does not have role "admin", redirect to /home.
 */
export default function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />; // should not happen (PrivateRoute already checks)
  if (user.role !== "admin") return <Navigate to="/home" replace />;
  return children;
}
