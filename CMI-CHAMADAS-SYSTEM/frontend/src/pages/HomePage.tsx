/**
 * Página inicial - redireciona por tipo de usuário
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function HomePage() {
  const { usuario, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  switch (usuario.tipo) {
    case 'MEDICO':
      return <Navigate to="/medico" replace />;
    case 'TRIAGEM':
      return <Navigate to="/triagem" replace />;
    case 'ADMIN':
      return <Navigate to="/admin" replace />;
    case 'DEV':
      return <Navigate to="/dev" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}
