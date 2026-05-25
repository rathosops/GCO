/**
 * App Principal - CMI Sistema de Chamadas
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { PainelPage } from "./pages/PainelPage";
import { MedicoPage } from "./pages/MedicoPage";
import { TriagemPage } from "./pages/TriagemPage";
import { HomePage } from "./pages/HomePage";
import type { ReactNode } from "react";

// Placeholder para páginas não críticas
function AdminPage() {
  return <div className="p-8 text-center">Admin - Em desenvolvimento</div>;
}

function DevPage() {
  return <div className="p-8 text-center">Dev - Em desenvolvimento</div>;
}

function ProtectedRoute({
  children,
  allowedTypes,
}: {
  children: ReactNode;
  allowedTypes?: string[];
}) {
  const { usuario, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedTypes && usuario && !allowedTypes.includes(usuario.tipo)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Rota pública - Painel da TV */}
      <Route path="/painel" element={<PainelPage />} />

      {/* Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Rotas protegidas */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/medico"
        element={
          <ProtectedRoute allowedTypes={["MEDICO", "ADMIN"]}>
            <MedicoPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/triagem"
        element={
          <ProtectedRoute allowedTypes={["TRIAGEM", "ADMIN"]}>
            <TriagemPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedTypes={["ADMIN"]}>
            <AdminPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dev"
        element={
          <ProtectedRoute allowedTypes={["DEV", "ADMIN"]}>
            <DevPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
