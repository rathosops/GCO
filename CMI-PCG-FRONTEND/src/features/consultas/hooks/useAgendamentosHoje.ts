/**
 * Hook para buscar agendamentos do dia atual
 * Usado na página de Consultas para exibir atendimentos pendentes
 */

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { Agendamento } from '@/types';
import { agendamentosAPI } from '@/services/api';

interface UseAgendamentosHojeReturn {
  agendamentos: Agendamento[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useAgendamentosHoje(): UseAgendamentosHojeReturn {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hoje = format(new Date(), 'yyyy-MM-dd');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await agendamentosAPI.getByData(hoje);
      // Ordena por hora
      const sorted = (Array.isArray(data) ? data : []).sort((a, b) => {
        const horaA = normalizeHora(a.hora);
        const horaB = normalizeHora(b.hora);
        return horaA.localeCompare(horaB);
      });
      setAgendamentos(sorted);
    } catch (err: any) {
      console.error('Erro ao carregar agendamentos de hoje:', err);
      setError(err?.response?.data?.error || 'Erro ao carregar agendamentos');
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  }, [hoje]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    agendamentos,
    loading,
    error,
    reload: load,
  };
}

function normalizeHora(h?: string | null): string {
  if (!h) return '00:00';
  const match = h.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return h;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}