/**
 * React Hooks para Médicos
 * 
 * @module features/medicos/hooks
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { debounce } from '@/utils/debounce';
import { medicosApi } from '../api';
import type {
  Medico,
  MedicoFilters,
  MedicosStats,
  MedicoPerformance,
  MedicoAutocomplete,
  RelatorioResumoMedicos,
  RelatorioConsultasPorMedico,
  RelatorioPorEspecialidade,
  RelatorioProdutividade,
  RelatorioOcupacao,
} from '../types';


// ============================================
// Hook: Lista de Médicos com Filtros
// ============================================
export interface UseMedicosOptions {
  initialFilters?: MedicoFilters;
  autoLoad?: boolean;
}

export function useMedicos(options: UseMedicosOptions = {}) {
  const { initialFilters = {}, autoLoad = true } = options;
  
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MedicoFilters>(initialFilters);
  const [hasMore, setHasMore] = useState(false);
  
  const load = useCallback(async (newFilters?: MedicoFilters) => {
    try {
      setLoading(true);
      setError(null);
      const params = newFilters ?? filters;
      const data = await medicosApi.getAll(params);
      setMedicos(data);
      setHasMore(data.length === (params.limit ?? 12));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      console.error('Erro ao carregar médicos:', err);
      setError(e?.response?.data?.error || 'Erro ao carregar médicos');
      setMedicos([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [filters]);
  
  const updateFilters = useCallback((newFilters: Partial<MedicoFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, offset: 0 }));
  }, []);
  
  const clearFilters = useCallback(() => {
    setFilters({ limit: 12, offset: 0 });
  }, []);
  
  const nextPage = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      offset: (prev.offset ?? 0) + (prev.limit ?? 12),
    }));
  }, []);
  
  const prevPage = useCallback(() => {
    setFilters(prev => ({
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
    medicos,
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
// Hook: Médico Individual
// ============================================
export function useMedico(id: number | null) {
  const [medico, setMedico] = useState<Medico | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const load = useCallback(async () => {
    if (!id) {
      setMedico(null);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await medicosApi.getById(id);
      setMedico(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      console.error('Erro ao carregar médico:', err);
      setError(e?.response?.data?.error || 'Erro ao carregar médico');
      setMedico(null);
    } finally {
      setLoading(false);
    }
  }, [id]);
  
  useEffect(() => {
    load();
  }, [load]);
  
  return { medico, loading, error, reload: load };
}


// ============================================
// Hook: Estatísticas
// ============================================
export function useMedicosStats() {
  const [stats, setStats] = useState<MedicosStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await medicosApi.getStats();
      setStats(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      console.error('Erro ao carregar estatísticas:', err);
      setError(e?.response?.data?.error || 'Erro ao carregar estatísticas');
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
// Hook: Performance do Médico
// ============================================
export function useMedicoPerformance(id: number | null, periodo = '12meses') {
  const [performance, setPerformance] = useState<MedicoPerformance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const load = useCallback(async (newPeriodo?: string) => {
    if (!id) {
      setPerformance(null);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await medicosApi.getPerformance(id, newPeriodo ?? periodo);
      setPerformance(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      console.error('Erro ao carregar performance:', err);
      setError(e?.response?.data?.error || 'Erro ao carregar performance');
    } finally {
      setLoading(false);
    }
  }, [id, periodo]);
  
  useEffect(() => {
    load();
  }, [load]);
  
  return { performance, loading, error, reload: load };
}


// ============================================
// Hook: Autocomplete
// ============================================
export function useMedicoAutocomplete(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MedicoAutocomplete[]>([]);
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
          const data = await medicosApi.autocomplete(q);
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
// Hook: Relatório Resumo
// ============================================
export function useRelatorioResumoMedicos(periodo = '30dias') {
  const [resumo, setResumo] = useState<RelatorioResumoMedicos | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const load = useCallback(async (newPeriodo?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await medicosApi.relatorios.getResumo(newPeriodo ?? periodo);
      setResumo(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      console.error('Erro ao carregar relatório:', err);
      setError(e?.response?.data?.error || 'Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  }, [periodo]);
  
  useEffect(() => {
    load();
  }, [load]);
  
  return { resumo, loading, error, reload: load };
}


// ============================================
// Hook: Ranking de Consultas
// ============================================
export function useRankingConsultas(periodo = '30dias', limite = 20) {
  const [ranking, setRanking] = useState<RelatorioConsultasPorMedico | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await medicosApi.relatorios.getConsultasPorMedico({ periodo, limite });
      setRanking(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      console.error('Erro ao carregar ranking:', err);
      setError(e?.response?.data?.error || 'Erro ao carregar ranking');
    } finally {
      setLoading(false);
    }
  }, [periodo, limite]);
  
  useEffect(() => {
    load();
  }, [load]);
  
  return { ranking, loading, error, reload: load };
}


// ============================================
// Hook: Por Especialidade
// ============================================
export function useRelatorioPorEspecialidade(periodo = '30dias') {
  const [relatorio, setRelatorio] = useState<RelatorioPorEspecialidade | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await medicosApi.relatorios.getPorEspecialidade(periodo);
      setRelatorio(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      console.error('Erro ao carregar relatório:', err);
      setError(e?.response?.data?.error || 'Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  }, [periodo]);
  
  useEffect(() => {
    load();
  }, [load]);
  
  return { relatorio, loading, error, reload: load };
}


// ============================================
// Hook: Produtividade
// ============================================
export function useRelatorioProdutividade(meses = 12) {
  const [produtividade, setProdutividade] = useState<RelatorioProdutividade | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await medicosApi.relatorios.getProdutividade(meses);
      setProdutividade(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      console.error('Erro ao carregar produtividade:', err);
      setError(e?.response?.data?.error || 'Erro ao carregar produtividade');
    } finally {
      setLoading(false);
    }
  }, [meses]);
  
  useEffect(() => {
    load();
  }, [load]);
  
  return { produtividade, loading, error, reload: load };
}


// ============================================
// Hook: Ocupação
// ============================================
export function useRelatorioOcupacao(periodo = '30dias') {
  const [ocupacao, setOcupacao] = useState<RelatorioOcupacao | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await medicosApi.relatorios.getOcupacao(periodo);
      setOcupacao(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      console.error('Erro ao carregar ocupação:', err);
      setError(e?.response?.data?.error || 'Erro ao carregar ocupação');
    } finally {
      setLoading(false);
    }
  }, [periodo]);
  
  useEffect(() => {
    load();
  }, [load]);
  
  return { ocupacao, loading, error, reload: load };
}


// ============================================
// Hook: CRUD Mutations
// ============================================
export function useMedicoMutations() {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const create = useCallback(async (data: Partial<Medico>) => {
    try {
      setSaving(true);
      setError(null);
      const result = await medicosApi.create(data);
      return result;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const msg = e?.response?.data?.error || 'Erro ao criar médico';
      setError(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  }, []);
  
  const update = useCallback(async (id: number, data: Partial<Medico>) => {
    try {
      setSaving(true);
      setError(null);
      const result = await medicosApi.update(id, data);
      return result;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const msg = e?.response?.data?.error || 'Erro ao atualizar médico';
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
      const result = await medicosApi.delete(id);
      return result;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const msg = e?.response?.data?.error || 'Erro ao excluir médico';
      setError(msg);
      throw new Error(msg);
    } finally {
      setDeleting(false);
    }
  }, []);
  
  return { create, update, remove, saving, deleting, error };
}