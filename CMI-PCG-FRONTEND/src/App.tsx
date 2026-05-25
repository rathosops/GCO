import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import LoginPage from '@/pages/LoginPage';
import DashboardLayout from '@/components/layout/DashboardLayout';
import HomePage from '@/pages/HomePage';
import PacientesPage from '@/features/pacientes/pages/PacientesPage';
import AgendamentosPage from '@/features/agendamentos/pages/AgendamentosPage';
import ConsultasPage from '@/features/consultas/pages/ConsultasPage';
import ReceituariosPage from '@/features/receituarios/pages/ReceituariosPage';
import FinanceiroPage from '@/features/financeiro/pages/FinanceiroPage';
import EmpresasPage from '@/features/empresas/pages/EmpresasPage';
import ConveniosPage from '@/features/convenios/pages/ConveniosPage';
import MedicosPage from '@/features/medicos/pages/MedicosPage';
import ExamesPage from '@/features/exames/pages/ExamesPage';
import FarmaciaPage from '@/features/farmacia/pages/FarmaciaPage';
import RelatoriosPage from '@/features/relatorios/pages/RelatoriosPage';
import AuditoriaPage from '@/features/auditoria/pages/AuditoriaPage';
import AsoPage from '@/features/aso/pages/AsoPage';
import PericiasImescPage from '@/features/pericias-imesc/pages/PericiasImescPage';

// Componente de proteção de rota
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function App() {
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="pacientes" element={<PacientesPage />} />
          <Route path="agendamentos" element={<AgendamentosPage />} />
          <Route path="consultas" element={<ConsultasPage />} />
          <Route path="receituarios" element={<ReceituariosPage />} />
          <Route path="financeiro" element={<FinanceiroPage />} />
          <Route path="empresas" element={<EmpresasPage />} />
          <Route path="convenios" element={<ConveniosPage />} />
          <Route path="medicos" element={<MedicosPage />} />
          <Route path="exames" element={<ExamesPage />} />
          <Route path="farmacia" element={<FarmaciaPage />} />
          <Route path="relatorios" element={<RelatoriosPage />} />
          <Route path="auditoria" element={<AuditoriaPage />} />
          <Route path="aso" element={<AsoPage />} />
          <Route path="pericias-imesc" element={<PericiasImescPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
