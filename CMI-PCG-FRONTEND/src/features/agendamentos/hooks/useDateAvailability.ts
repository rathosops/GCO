/**
 * Hook para verificar disponibilidade de data para agendamento
 * Verifica feriados e fins de semana
 */
import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { feriadosAPI, type VerificarDataResponse } from '@/services/feriados.api';

export interface DateAvailability {
  loading: boolean;
  disponivel: boolean;
  motivo: string | null;
  isFeriado: boolean;
  isFimDeSemana: boolean;
  feriadoNome: string | null;
}

const initialState: DateAvailability = {
  loading: false,
  disponivel: true,
  motivo: null,
  isFeriado: false,
  isFimDeSemana: false,
  feriadoNome: null,
};

export function useDateAvailability(selectedDate: Date | null) {
  const [availability, setAvailability] = useState<DateAvailability>(initialState);

  const checkDate = useCallback(async (date: Date) => {
    const diaISO = format(date, 'yyyy-MM-dd');

    // Verifica fim de semana localmente primeiro (otimização)
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const dayName = dayOfWeek === 0 ? 'Domingo' : 'Sábado';
      setAvailability({
        loading: false,
        disponivel: false,
        motivo: `Fim de semana (${dayName})`,
        isFeriado: false,
        isFimDeSemana: true,
        feriadoNome: null,
      });
      return;
    }

    try {
      setAvailability((prev) => ({ ...prev, loading: true }));

      const res: VerificarDataResponse = await feriadosAPI.verificarData(diaISO);

      setAvailability({
        loading: false,
        disponivel: res.disponivel,
        motivo: res.motivo,
        isFeriado: res.is_feriado ?? false,
        isFimDeSemana: res.is_fim_de_semana ?? false,
        feriadoNome: res.feriado_nome ?? null,
      });
    } catch (error) {
      console.error('Erro ao verificar disponibilidade da data:', error);
      // Em caso de erro na API, permite continuar (fail-open)
      setAvailability({
        loading: false,
        disponivel: true,
        motivo: null,
        isFeriado: false,
        isFimDeSemana: false,
        feriadoNome: null,
      });
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      checkDate(selectedDate);
    } else {
      setAvailability(initialState);
    }
  }, [selectedDate, checkDate]);

  return {
    ...availability,
    refetch: () => selectedDate && checkDate(selectedDate),
  };
}

/**
 * Hook simplificado para verificar uma data específica sob demanda
 */
export function useCheckDateAvailability() {
  const [checking, setChecking] = useState(false);

  const check = useCallback(async (date: Date): Promise<VerificarDataResponse | null> => {
    const diaISO = format(date, 'yyyy-MM-dd');

    // Verifica fim de semana localmente
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const dayName = dayOfWeek === 0 ? 'Domingo' : 'Sábado';
      return {
        data: diaISO,
        disponivel: false,
        motivo: `Fim de semana (${dayName})`,
        is_fim_de_semana: true,
      };
    }

    try {
      setChecking(true);
      const res = await feriadosAPI.verificarData(diaISO);
      return res;
    } catch (error) {
      console.error('Erro ao verificar data:', error);
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  return { check, checking };
}
