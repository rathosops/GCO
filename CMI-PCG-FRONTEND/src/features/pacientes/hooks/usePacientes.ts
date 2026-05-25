/**
 * React Hooks para Pacientes
 *
 * @module features/pacientes/hooks
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { debounce } from '@/utils/debounce';
import { pacientesApi } from '../api';
import type {
  Paciente,
  PacienteFilters,
  PacientesStats,
  ProntuarioResponse,
  PacientesFrequentesResponse,
  FrequenciaResponse,
  PacienteAutocomplete,
  RelatorioResumo,
  RelatorioFidelidade,
  Aniversariante,
  PacienteInativo,
  NivelFidelidade,
} from '../types';

// ============================================
// Hook: Lista de Pacientes com Filtros
// ============================================
export interface UsePacientesOptions {
  initialFilters?: PacienteFilters;
  autoLoad?: boolean;
}

export function usePacientes(options: UsePacientesOptions = {}) {
  const { initialFilters = {}, autoLoad = true } = options;

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PacienteFilters>(initialFilters);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async (newFilters?: PacienteFilters) => {
      try {
        setLoading(true);
        setError(null);
        const params = newFilters ?? filters;
        const data = await pacientesApi.getAll(params);
        setPacientes(data);
        setHasMore(data.length === (params.limit ?? 12));
      } catch (err: any) {
        console.error('Erro ao carregar pacientes:', err);
        setError(err?.response?.data?.error || 'Erro ao carregar pacientes');
        setPacientes([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  const updateFilters = useCallback((newFilters: Partial<PacienteFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, offset: 0 }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ limit: 12, offset: 0 });
  }, []);

  const nextPage = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      offset: (prev.offset ?? 0) + (prev.limit ?? 12),
    }));
  }, []);

  const prevPage = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      offset: Math.max(0, (prev.offset ?? 0) - (prev.limit ?? 12)),
    }));
  }, []);

  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [filters, autoLoad, load]);

  return {
    pacientes,
    loading,
    error,
    filters,
    hasMore,
    load,
    reload: () => load(),
    updateFilters,
    clearFilters,
    nextPage,
    prevPage,
    page: Math.floor((filters.offset ?? 0) / (filters.limit ?? 12)) + 1,
  };
}

// ============================================
// Hook: Paciente Individual
// ============================================
export function usePaciente(id: number | null) {
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setPaciente(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await pacientesApi.getById(id);
      setPaciente(data);
    } catch (err: any) {
      console.error('Erro ao carregar paciente:', err);
      setError(err?.response?.data?.error || 'Erro ao carregar paciente');
      setPaciente(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { paciente, loading, error, reload: load };
}

// ============================================
// Hook: Estatísticas
// ============================================
export function usePacientesStats() {
  const [stats, setStats] = useState<PacientesStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await pacientesApi.getStats();
      setStats(data);
    } catch (err: any) {
      console.error('Erro ao carregar estatísticas:', err);
      setError(err?.response?.data?.error || 'Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, loading, error, reload: load };
}

// ============================================
// Hook: Frequência do Paciente
// ============================================
export function usePacienteFrequencia(id: number | null) {
  const [frequencia, setFrequencia] = useState<FrequenciaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setFrequencia(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await pacientesApi.getFrequencia(id);
      setFrequencia(data);
    } catch (err: any) {
      console.error('Erro ao carregar frequência:', err);
      setError(err?.response?.data?.error || 'Erro ao carregar frequência');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { frequencia, loading, error, reload: load };
}

// ============================================
// Hook: Prontuário
// ============================================
export function useProntuario(cpf: string | null) {
  const [prontuario, setProntuario] = useState<ProntuarioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cpf) {
      setProntuario(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await pacientesApi.getProntuario(cpf);
      setProntuario(data);
    } catch (err: any) {
      console.error('Erro ao carregar prontuário:', err);
      setError(err?.response?.data?.error || 'Erro ao carregar prontuário');
    } finally {
      setLoading(false);
    }
  }, [cpf]);

  useEffect(() => {
    load();
  }, [load]);

  return { prontuario, loading, error, reload: load };
}

// ============================================
// Hook: Autocomplete
// ============================================
export function usePacienteAutocomplete(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PacienteAutocomplete[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedSearch = useMemo(
    () =>
      debounce(async (q: string) => {
        if (q.length < 2) {
          setResults([]);
          return;
        }

        try {
          setLoading(true);
          const data = await pacientesApi.autocomplete(q);
          setResults(data);
        } catch (err) {
          console.error('Erro no autocomplete:', err);
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  return { query, setQuery, results, loading };
}

// ============================================
// Hook: Pacientes Frequentes
// (CORRIGIDO: evitar params objeto como dependência)
// ============================================
export function usePacientesFrequentes(params?: { limite?: number; min_consultas?: number }) {
  const limite = params?.limite;
  const min_consultas = params?.min_consultas;

  const [data, setData] = useState<PacientesFrequentesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await pacientesApi.getFrequentes({ limite, min_consultas });
      setData(result);
    } catch (err: any) {
      console.error('Erro ao carregar pacientes frequentes:', err);
      setError(err?.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [limite, min_consultas]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

// ============================================
// Hook: Relatório Resumo
// ============================================
export function useRelatorioResumo(periodo = '30dias') {
  const [resumo, setResumo] = useState<RelatorioResumo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (newPeriodo?: string) => {
      try {
        setLoading(true);
        setError(null);
        const data = await pacientesApi.relatorios.getResumo(newPeriodo ?? periodo);
        setResumo(data);
      } catch (err: any) {
        console.error('Erro ao carregar relatório:', err);
        setError(err?.response?.data?.error || 'Erro ao carregar relatório');
      } finally {
        setLoading(false);
      }
    },
    [periodo]
  );

  useEffect(() => {
    load();
  }, [load]);

  return { resumo, loading, error, reload: load };
}

// ============================================
// Hook: Relatório Fidelidade
// ============================================
export function useRelatorioFidelidade() {
  const [fidelidade, setFidelidade] = useState<RelatorioFidelidade | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await pacientesApi.relatorios.getFidelidade();
      setFidelidade(data);
    } catch (err: any) {
      console.error('Erro ao carregar fidelidade:', err);
      setError(err?.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { fidelidade, loading, error, reload: load };
}

// ============================================
// Hook: Aniversariantes
// (CORRIGIDO: evitar params objeto como dependência)
// ============================================
export function useAniversariantes(params?: { mes?: number; dias?: number }) {
  const mes = params?.mes;
  const dias = params?.dias;

  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await pacientesApi.relatorios.getAniversariantes({ mes, dias });
      setAniversariantes(data.aniversariantes);
      setTotal(data.total);
    } catch (err: any) {
      console.error('Erro ao carregar aniversariantes:', err);
      setError(err?.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [mes, dias]);

  useEffect(() => {
    load();
  }, [load]);

  return { aniversariantes, total, loading, error, reload: load };
}

// ============================================
// Hook: Pacientes Inativos
// (CORRIGIDO: evitar params objeto como dependência)
// ============================================
export function usePacientesInativos(params?: { dias?: number; limite?: number }) {
  const dias = params?.dias;
  const limite = params?.limite;

  const [inativos, setInativos] = useState<PacienteInativo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await pacientesApi.relatorios.getInativos({ dias, limite });
      setInativos(data.pacientes);
    } catch (err: any) {
      console.error('Erro ao carregar inativos:', err);
      setError(err?.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [dias, limite]);

  useEffect(() => {
    load();
  }, [load]);

  return { inativos, loading, error, reload: load };
}

// ============================================
// Hook: CRUD Mutations
// ============================================
export function usePacienteMutations() {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (data: Partial<Paciente>) => {
    try {
      setSaving(true);
      setError(null);
      const result = await pacientesApi.create(data);
      return result;
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Erro ao criar paciente';
      setError(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<Paciente>) => {
    try {
      setSaving(true);
      setError(null);
      const result = await pacientesApi.update(id, data);
      return result;
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Erro ao atualizar paciente';
      setError(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      setDeleting(true);
      setError(null);
      const result = await pacientesApi.delete(id);
      return result;
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Erro ao excluir paciente';
      setError(msg);
      throw new Error(msg);
    } finally {
      setDeleting(false);
    }
  }, []);

  return { create, update, remove, saving, deleting, error };
}

// ============================================
// Hook: Download PDFs
// ============================================
export function usePacientePdfDownload() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadFicha = useCallback(async (id: number, nome?: string) => {
    try {
      setDownloading(true);
      setError(null);
      const blob = await pacientesApi.downloadFichaPdf(id);
      downloadBlob(blob, `ficha_${nome || id}.pdf`);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Erro ao baixar ficha';
      setError(msg);
    } finally {
      setDownloading(false);
    }
  }, []);

  const downloadProntuario = useCallback(async (id: number, nome?: string) => {
    try {
      setDownloading(true);
      setError(null);
      const blob = await pacientesApi.downloadProntuarioPdf(id);
      downloadBlob(blob, `prontuario_${nome || id}.pdf`);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Erro ao baixar prontuário';
      setError(msg);
    } finally {
      setDownloading(false);
    }
  }, []);

  return { downloadFicha, downloadProntuario, downloading, error };
}

// ============================================
// Utilitário: Badge de Nível de Fidelidade
// ============================================
export function getNivelFidelidadeConfig(nivel: NivelFidelidade) {
  const configs = {
    novo: {
      label: 'Novo',
      color: 'bg-gray-100 text-gray-700',
      icon: '🆕',
    },
    bronze: {
      label: 'Bronze',
      color: 'bg-amber-100 text-amber-700',
      icon: '🥉',
    },
    prata: {
      label: 'Prata',
      color: 'bg-slate-200 text-slate-700',
      icon: '🥈',
    },
    ouro: {
      label: 'Ouro',
      color: 'bg-yellow-100 text-yellow-700',
      icon: '🥇',
    },
  };

  return configs[nivel] || configs.novo;
}
