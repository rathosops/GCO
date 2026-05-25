/**
 * Lista de chamadas ativas - Componente memoizado
 */

import { memo } from 'react';
import type { ChamadaPainel } from '../types';
import { formatHoraIso, getStatusColor, getTipoColor, getTipoLabel } from '../utils/format';

interface ChamadasAtivasListProps {
  chamadas: ChamadaPainel[];
  title?: string;
  accentColorClass?: string;
  subtitle?: string;
  showCountBadge?: boolean;
  currentUserName?: string | null;
  className?: string;
}

export const ChamadasAtivasList = memo(function ChamadasAtivasList({
  chamadas,
  title = 'Chamadas Ativas',
  accentColorClass = 'text-blue-500',
  subtitle,
  showCountBadge = true,
  currentUserName,
  className = '',
}: ChamadasAtivasListProps) {
  return (
    <section className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-6 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span
            className={`w-5 h-5 rounded-full ${accentColorClass
              .replace('text', 'bg')
              .replace('-500', '-100')} flex items-center justify-center`}
          >
            <span
              className={`${accentColorClass.replace('text-', '')} w-2 h-2 rounded-full block`}
            />
          </span>
          <span>{title}</span>
          {subtitle && <span className="text-sm text-gray-400 ml-1">({subtitle})</span>}
        </h2>
        {showCountBadge && (
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">
            {chamadas.length} chamada(s)
          </span>
        )}
      </div>

      {chamadas.length === 0 ? (
        <p className="text-gray-500 text-center py-6">Nenhuma chamada ativa no momento</p>
      ) : (
        <div className="space-y-2 max-h-[260px] overflow-y-auto">
          {chamadas.map((c) => {
            const isMinha = currentUserName && c.chamado_por_nome === currentUserName;
            return (
              <div
                key={c.id}
                className={`p-3 border rounded-lg flex justify-between items-center text-sm ${
                  isMinha ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div>
                  <p className="font-medium text-gray-800">
                    {c.nome_paciente}{' '}
                    {isMinha && (
                      <span className="text-xs text-blue-600 font-semibold ml-1">(sua)</span>
                    )}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {c.sala} • {c.chamado_por_nome}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Chamado às {formatHoraIso(c.chamado_em)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getTipoColor(
                      c.tipo,
                    )}`}
                  >
                    {getTipoLabel(c.tipo)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(
                      c.status,
                    )}`}
                  >
                    {c.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
});
