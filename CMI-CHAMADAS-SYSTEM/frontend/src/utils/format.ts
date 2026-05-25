/**
 * Utilitários de formatação
 */

import type { ChamadaPainel } from '../types';

/** Formata horário HH:MM */
export const formatHora = (hora?: string | null) => {
  if (!hora) return '--:--';
  return hora.slice(0, 5);
};

/** Formata ISO para HH:MM */
export const formatHoraIso = (iso?: string | null) => {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Cores de status */
export const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    REALIZADO: 'bg-green-100 text-green-800',
    FALTOU: 'bg-red-100 text-red-800',
    CHAMANDO: 'bg-yellow-100 text-yellow-800',
    ATENDENDO: 'bg-blue-100 text-blue-800',
    FINALIZADO: 'bg-emerald-100 text-emerald-800',
    NAO_COMPARECEU: 'bg-red-100 text-red-800',
    CANCELADO: 'bg-gray-100 text-gray-800',
  };
  return map[status] || 'bg-gray-100 text-gray-800';
};

/** Label do tipo de chamada */
export const getTipoLabel = (tipo: ChamadaPainel['tipo']) => {
  if (tipo === 'TRIAGEM') return 'TRIAGEM';
  if (tipo === 'MEDICO') return 'MÉDICO';
  return tipo;
};

/** Cor do tipo */
export const getTipoColor = (tipo: ChamadaPainel['tipo']) => {
  if (tipo === 'TRIAGEM') return 'bg-purple-100 text-purple-700';
  if (tipo === 'MEDICO') return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-700';
};
