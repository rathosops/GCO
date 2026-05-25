/**
 * Hooks customizados para o módulo de Consultas
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { consultasAPI, consultasRelatoriosAPI, consultasDepsAPI } from '@/features/consultas/api/consultas.api';
import { debounce } from '@/utils/debounce';
import type {
  Consulta,
  ConsultaResumo,
  ConsultaFilters,
  ConsultaStats,
  ConsultaPorTipo,
  ConsultaPorMedico,
  PacienteFrequente,
  ResumoMensal,
  MedicoOption,
  ProcedimentoOption,
} from '@/features/consultas/types/consultas.types';

// =============================================================================
// useConsultas - Lista com filtros e paginação
// =============================================================================
interface UseConsultasOptions {
  autoLoad?: boolean;
  defaultFilters?: Partial<ConsultaFilters>;
  resumo?: boolean;
}

interface UseConsultasReturn {
  items: (Consulta | ConsultaResumo)[];
  loading: boolean;
  error: string | null;
  filters: ConsultaFilters;
  setFilter: <K extends keyof ConsultaFilters>(key: K, value: ConsultaFilters[K]) => void;
  setFilters: (newFilters: Partial<ConsultaFilters>) => void;
  resetFilters: () => void;
  reload: () => Promise<void>;
  hasMore: boolean;
  loadMore: () => void;
  total: number;
}

const DEFAULT_FILTERS: ConsultaFilters = {
  search: '',
  tipo: '',
  order: 'data_desc',
  limit: 30,
  offset: 0,
};

export function useConsultas(options: UseConsultasOptions = {}): UseConsultasReturn {
  const { autoLoad = true, defaultFilters = {}, resumo = false } = options;

  const [items, setItems] = useState<(Consulta | ConsultaResumo)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<ConsultaFilters>({
    ...DEFAULT_FILTERS,
    ...defaultFilters,
    resumo,
  });
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (currentFilters: ConsultaFilters, append = false) => {
    try {
      setLoading(true);
      setError(null);

      const data = await consultasAPI.list(currentFilters);
      const arr = Array.isArray(data) ? data : [];

      if (append) {
        setItems((prev) => [...prev, ...arr]);
      } else {
        setItems(arr);
      }

      setHasMore(arr.length === (currentFilters.limit || 30));
      if (!append) {
        setTotal(arr.length);
      } else {
        setTotal((prev) => prev + arr.length);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao carregar consultas');
      if (!append) setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce para busca
  const debouncedLoad = useMemo(
    () => debounce((f: ConsultaFilters) => load(f), 300),
    [load]
  );

  // Carrega quando filtros mudam
  useEffect(() => {
    if (autoLoad) {
      debouncedLoad({ ...filters, offset: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.search,
    filters.tipo,
    filters.cpf_paciente,
    filters.crm_medico,
    filters.data,
    filters.data_inicio,
    filters.data_fim,
    filters.houve_exame,
    filters.houve_prescricao,
    filters.order,
    autoLoad,
  ]);

  const setFilter = useCallback(<K extends keyof ConsultaFilters>(
    key: K,
    value: ConsultaFilters[K]
  ) => {
    setFiltersState((prev) => ({ ...prev, [key]: value, offset: 0 }));
  }, []);

  const setFilters = useCallback((newFilters: Partial<ConsultaFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters, offset: 0 }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({ ...DEFAULT_FILTERS, ...defaultFilters, resumo });
  }, [defaultFilters, resumo]);

  const reload = useCallback(async () => {
    await load({ ...filters, offset: 0 });
  }, [load, filters]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const newOffset = (filters.offset || 0) + (filters.limit || 30);
      const newFilters = { ...filters, offset: newOffset };
      setFiltersState(newFilters);
      load(newFilters, true);
    }
  }, [loading, hasMore, filters, load]);

  return {
    items,
    loading,
    error,
    filters,
    setFilter,
    setFilters,
    resetFilters,
    reload,
    hasMore,
    loadMore,
    total,
  };
}

// =============================================================================
// useConsultaStats - Estatísticas
// =============================================================================
export function useConsultaStats(params?: { data_inicio?: string; data_fim?: string }) {
  const [stats, setStats] = useState<ConsultaStats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await consultasAPI.getStats(params);
      setStats(data);
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    } finally {
      setLoading(false);
    }
  }, [params?.data_inicio, params?.data_fim]);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, loading, reload: load };
}

// =============================================================================
// useConsultaTipos - Lista de tipos únicos
// =============================================================================
export function useConsultaTipos() {
  const [tipos, setTipos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await consultasAPI.getTipos();
        setTipos(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Erro ao carregar tipos:', err);
        setTipos([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { tipos, loading };
}

// =============================================================================
// useConsultaDeps - Médicos e Procedimentos
// =============================================================================
export function useConsultaDeps() {
  const [medicos, setMedicos] = useState<MedicoOption[]>([]);
  const [procedimentos, setProcedimentos] = useState<ProcedimentoOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [m, p] = await Promise.all([
          consultasDepsAPI.getMedicos(),
          consultasDepsAPI.getProcedimentos(),
        ]);
        setMedicos(Array.isArray(m) ? m : []);
        setProcedimentos(Array.isArray(p) ? p : []);
      } catch (err) {
        console.error('Erro ao carregar dependências:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { medicos, procedimentos, loading };
}

// =============================================================================
// useConsultasPorTipo - Relatório
// =============================================================================
export function useConsultasPorTipo(params?: {
  data_inicio?: string;
  data_fim?: string;
  limite?: number;
}) {
  const [data, setData] = useState<ConsultaPorTipo[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await consultasRelatoriosAPI.porTipo(params);
      setData(result);
    } catch (err) {
      console.error('Erro no relatório:', err);
    } finally {
      setLoading(false);
    }
  }, [params?.data_inicio, params?.data_fim, params?.limite]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, reload: load };
}

// =============================================================================
// useConsultasPorMedico - Relatório
// =============================================================================
export function useConsultasPorMedico(params?: {
  data_inicio?: string;
  data_fim?: string;
  limite?: number;
}) {
  const [data, setData] = useState<ConsultaPorMedico[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await consultasRelatoriosAPI.porMedico(params);
      setData(result);
    } catch (err) {
      console.error('Erro no relatório:', err);
    } finally {
      setLoading(false);
    }
  }, [params?.data_inicio, params?.data_fim, params?.limite]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, reload: load };
}

// =============================================================================
// usePacientesFrequentes - Relatório
// =============================================================================
export function usePacientesFrequentes(params?: {
  data_inicio?: string;
  data_fim?: string;
  limite?: number;
  min_consultas?: number;
}) {
  const [data, setData] = useState<PacienteFrequente[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await consultasRelatoriosAPI.pacientesFrequentes(params);
      setData(result);
    } catch (err) {
      console.error('Erro no relatório:', err);
    } finally {
      setLoading(false);
    }
  }, [params?.data_inicio, params?.data_fim, params?.limite, params?.min_consultas]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, reload: load };
}

// =============================================================================
// useResumoMensal - Relatório
// =============================================================================
export function useResumoMensal(ano?: number) {
  const [data, setData] = useState<ResumoMensal | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await consultasRelatoriosAPI.resumoMensal(ano);
      setData(result);
    } catch (err) {
      console.error('Erro no resumo:', err);
    } finally {
      setLoading(false);
    }
  }, [ano]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, reload: load };
}