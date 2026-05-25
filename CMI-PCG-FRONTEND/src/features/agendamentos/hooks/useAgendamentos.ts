import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { Agendamento, AgendamentoStatus } from '@/types';
import { agendamentosAPI } from '../api';
import { extractApiErrorMessage } from '../utils/agendamentos.helpers';

export function useAgendamentos(selectedDate: Date) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const diaISO = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  const loadAgendamentos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await agendamentosAPI.getByData(diaISO);
      setAgendamentos(Array.isArray(response) ? response : []);
    } catch (e) {
      console.error('Erro ao carregar agendamentos:', e);
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  }, [diaISO]);

  useEffect(() => {
    loadAgendamentos();
  }, [loadAgendamentos]);

  const createAgendamento = useCallback(async (payload: Partial<Agendamento>) => {
    try {
      setSaving(true);
      await agendamentosAPI.create(payload);
      await loadAgendamentos();
    } catch (e) {
      const msg = extractApiErrorMessage(e);
      alert(msg);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [loadAgendamentos]);

  const updateAgendamento = useCallback(async (id: number, payload: Partial<Agendamento>) => {
    try {
      setSaving(true);
      const updated = await agendamentosAPI.update(id, payload);
      const data = (updated as any)?.agendamento ? (updated as any).agendamento : updated;
      setAgendamentos((prev) => prev.map((x) => (x.id === id ? { ...x, ...data } : x)));
      return data as Agendamento;
    } catch (e) {
      const msg = extractApiErrorMessage(e);
      alert(msg);
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteAgendamento = useCallback(async (id: number) => {
    const prev = agendamentos;
    setAgendamentos((p) => p.filter((x) => x.id !== id));
    try {
      await agendamentosAPI.delete(id);
    } catch (e) {
      console.error('Erro ao excluir agendamento:', e);
      alert(extractApiErrorMessage(e));
      setAgendamentos(prev);
      throw e;
    }
  }, [agendamentos]);

  const setComparecimento = useCallback(async (ag: Agendamento, compareceu: boolean | null) => {
    if (!ag.id) return;

    try {
      setUpdatingId(ag.id);

      const nextStatus: AgendamentoStatus =
        compareceu === true ? 'REALIZADO' : compareceu === false ? 'FALTOU' : 'AGENDADO';

      const updated = await agendamentosAPI.update(ag.id, {
        paciente_compareceu: compareceu,
        status: nextStatus,
      });

      const payload = (updated as any)?.agendamento ? (updated as any).agendamento : updated;
      setAgendamentos((prev) => prev.map((x) => (x.id === ag.id ? { ...x, ...payload } : x)));
    } catch (e) {
      console.error('Erro ao atualizar comparecimento:', e);
      alert(extractApiErrorMessage(e));
      throw e;
    } finally {
      setUpdatingId(null);
    }
  }, []);

  return {
    diaISO,
    agendamentos,
    setAgendamentos,
    loading,
    saving,
    updatingId,
    loadAgendamentos,
    createAgendamento,
    updateAgendamento,
    deleteAgendamento,
    setComparecimento,
  };
}
