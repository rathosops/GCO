// src/features/consultas/hooks/useProntuario.ts

import { useCallback, useState } from 'react';
import { pacientesAPI } from '@/services/api';
import type { ProntuarioResponse, Paciente } from '@/types';
import { autocompleteAPI, AutocompletePaciente } from '@/services/autocomplete.api';

interface ProntuarioFilters {
  data_inicio?: string;
  data_fim?: string;
  tipo?: string;
  busca?: string;
}

export function useProntuario() {
  const [prontuario, setProntuario] = useState<ProntuarioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProntuario = useCallback(async (cpf: string, filters?: ProntuarioFilters) => {
    if (!cpf || cpf.length !== 11) {
      setError('CPF inválido');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await pacientesAPI.getProntuario(cpf);
      setProntuario(data);
    } catch (err: any) {
      console.error('Erro ao carregar prontuário:', err);
      setError(err?.response?.data?.error || 'Erro ao carregar prontuário');
      setProntuario(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setProntuario(null);
    setError(null);
  }, []);

  return { prontuario, loading, error, loadProntuario, clear };
}

export function usePacienteSearch() {
  const [results, setResults] = useState<AutocompletePaciente[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      const data = await autocompleteAPI.pacientes(query, { limit: 15 });
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => setResults([]), []);

  return { results, loading, search, clear };
}