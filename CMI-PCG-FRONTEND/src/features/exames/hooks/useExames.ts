/**
 * Hooks customizados para o módulo de Exames
 *
 * Correções aplicadas:
 *   - useEffect agora observa TODOS os filtros (valor_min, valor_max inclusos)
 *   - Debounce só no campo de busca textual; filtros discretos disparam imediatamente
 *   - useSolicitacoes: referência estável p/ evitar loops infinitos
 *   - Paginação real com controle de página e total
 *
 * @module features/exames/hooks
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { examesAPI, solicitacoesExamesAPI, examesRelatoriosAPI } from '../api';
import { n } from '../types';
import { debounce } from '@/utils/debounce';
import type {
  Exame,
  ExameFilters,
  ExameStats,
  ExameCategoria,
  SolicitacaoExame,
  SolicitacaoFilters,
  ExameMaisSolicitado,
} from '../types';

// =============================================================================
// Mapeamento de categorias para tipos do backend
// =============================================================================
const CATEGORIA_TIPOS: Record<ExameCategoria, string[]> = {
  TODOS: [],
  LABORATORIAL: ['LABORATORIAL', 'SANGUE', 'URINA', 'HORMONAL', 'BIOQUIMICO'],
  IMAGEM: ['IMAGEM', 'RAIO-X', 'ULTRASSOM', 'TOMOGRAFIA', 'RESSONANCIA'],
  CLINICO: ['CLINICO', 'CARDIOLOGICO', 'OFTALMOLOGICO', 'AUDIOMETRIA', 'ESPIROMETRIA'],
  OUTROS: [],
};

function filterByCategoria(exames: Exame[], categoria: ExameCategoria): Exame[] {
  if (categoria === 'TODOS') return exames;

  const tiposCategoria = CATEGORIA_TIPOS[categoria];
  if (!tiposCategoria.length) {
    const allKnown = Object.values(CATEGORIA_TIPOS)
      .flat()
      .map((t) => t.toUpperCase());
    return exames.filter((e) => !allKnown.includes((e.tipo || '').toUpperCase()));
  }

  return exames.filter((e) =>
    tiposCategoria.some((t) => (e.tipo || '').toUpperCase().includes(t))
  );
}

// =============================================================================
// useExames — com paginação e filtros corrigidos
// =============================================================================
interface UseExamesOptions {
  autoLoad?: boolean;
  defaultFilters?: Partial<ExameFilters>;
  pageSize?: number;
}

interface UseExamesReturn {
  items: Exame[];
  filteredItems: Exame[];
  loading: boolean;
  error: string | null;
  filters: ExameFilters;
  categoria: ExameCategoria;
  setCategoria: (cat: ExameCategoria) => void;
  setFilter: <K extends keyof ExameFilters>(key: K, value: ExameFilters[K]) => void;
  resetFilters: () => void;
  reload: () => Promise<void>;
  // Paginação
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  hasMore: boolean;
  totalLoaded: number;
}

const DEFAULT_EXAME_FILTERS: ExameFilters = {
  search: '',
  tipo: '',
  ativo: true,
  order: 'nome_asc',
  limit: 50,
  offset: 0,
};

export function useExames(options: UseExamesOptions = {}): UseExamesReturn {
  const { autoLoad = true, defaultFilters = {}, pageSize = 50 } = options;

  const [items, setItems] = useState<Exame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<ExameCategoria>('TODOS');
  const [page, setPageInternal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<ExameFilters>({
    ...DEFAULT_EXAME_FILTERS,
    limit: pageSize,
    ...defaultFilters,
  });

  // Ref para evitar chamadas duplicadas
  const loadingRef = useRef(false);

  const load = useCallback(
    async (currentFilters: ExameFilters) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        setLoading(true);
        setError(null);
        const data = await examesAPI.list(currentFilters);
        setItems(data);
        setHasMore(data.length === (currentFilters.limit || pageSize));
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Erro ao carregar exames');
        setItems([]);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [pageSize]
  );

  // Debounce APENAS para busca textual
  const debouncedSearchLoad = useMemo(
    () => debounce((f: ExameFilters) => load(f), 350),
    [load]
  );

  // Efeito para busca textual (com debounce)
  useEffect(() => {
    if (!autoLoad) return;
    const filtersWithPage = { ...filters, offset: page * pageSize, limit: pageSize };
    debouncedSearchLoad(filtersWithPage);
    // Cleanup do debounce ao desmontar
    return () => debouncedSearchLoad.cancel?.();
  }, [filters.search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Efeito para filtros discretos (sem debounce)
  useEffect(() => {
    if (!autoLoad) return;
    const filtersWithPage = { ...filters, offset: page * pageSize, limit: pageSize };
    load(filtersWithPage);
  }, [filters.tipo, filters.ativo, filters.order, filters.valor_min, filters.valor_max, page, autoLoad]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredItems = useMemo(
    () => filterByCategoria(items, categoria),
    [items, categoria]
  );

  const setFilter = useCallback(
    <K extends keyof ExameFilters>(key: K, value: ExameFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      // Reset para primeira página ao mudar qualquer filtro
      setPageInternal(0);
    },
    []
  );

  const setPage = useCallback((newPage: number) => {
    setPageInternal(Math.max(0, newPage));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_EXAME_FILTERS, limit: pageSize, ...defaultFilters });
    setCategoria('TODOS');
    setPageInternal(0);
  }, [defaultFilters, pageSize]);

  const reload = useCallback(async () => {
    const filtersWithPage = { ...filters, offset: page * pageSize, limit: pageSize };
    await load(filtersWithPage);
  }, [load, filters, page, pageSize]);

  return {
    items,
    filteredItems,
    loading,
    error,
    filters,
    categoria,
    setCategoria,
    setFilter,
    resetFilters,
    reload,
    page,
    setPage,
    pageSize,
    hasMore,
    totalLoaded: items.length,
  };
}

// =============================================================================
// useExameSelection (sem mudanças estruturais)
// =============================================================================
interface UseExameSelectionReturn {
  selected: Exame[];
  selectedIds: Set<number>;
  toggle: (exame: Exame) => void;
  selectAll: (exames: Exame[]) => void;
  clearSelection: () => void;
  isSelected: (id: number) => boolean;
  totalCmi: number;
  totalVenda: number;
  totalParceiro: number;
  quantidade: number;
  desconto: number;
  setDesconto: (valor: number) => void;
  descontoPercentual: number;
  setDescontoPercentual: (valor: number) => void;
  totalFinal: number;
  margemBruta: number;
}

export function useExameSelection(): UseExameSelectionReturn {
  const [selected, setSelected] = useState<Exame[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [descontoPercentual, setDescontoPercentual] = useState(0);

  const selectedIds = useMemo(() => new Set(selected.map((e) => e.id)), [selected]);

  const toggle = useCallback((exame: Exame) => {
    setSelected((prev) => {
      const exists = prev.find((e) => e.id === exame.id);
      return exists ? prev.filter((e) => e.id !== exame.id) : [...prev, exame];
    });
  }, []);

  const selectAll = useCallback((exames: Exame[]) => setSelected(exames), []);

  const clearSelection = useCallback(() => {
    setSelected([]);
    setDesconto(0);
    setDescontoPercentual(0);
  }, []);

  const isSelected = useCallback((id: number) => selectedIds.has(id), [selectedIds]);

  const totalCmi = useMemo(() => selected.reduce((a, e) => a + n(e.valor_cmi), 0), [selected]);
  const totalVenda = useMemo(() => selected.reduce((a, e) => a + n(e.valor_venda), 0), [selected]);
  const totalParceiro = useMemo(() => selected.reduce((a, e) => a + n(e.valor_parceiro), 0), [selected]);

  const descontoCalculado = useMemo(() => {
    if (descontoPercentual > 0) return totalVenda * (descontoPercentual / 100);
    return desconto;
  }, [totalVenda, desconto, descontoPercentual]);

  const totalFinal = useMemo(() => Math.max(0, totalVenda - descontoCalculado), [totalVenda, descontoCalculado]);
  const margemBruta = useMemo(() => totalFinal - totalCmi, [totalFinal, totalCmi]);

  return {
    selected,
    selectedIds,
    toggle,
    selectAll,
    clearSelection,
    isSelected,
    totalCmi,
    totalVenda,
    totalParceiro,
    quantidade: selected.length,
    desconto: descontoCalculado,
    setDesconto,
    descontoPercentual,
    setDescontoPercentual,
    totalFinal,
    margemBruta,
  };
}

// =============================================================================
// useExameTipos
// =============================================================================
export function useExameTipos() {
  const [tipos, setTipos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await examesAPI.getTipos();
        if (!cancelled) setTipos(data);
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return { tipos, loading };
}

// =============================================================================
// useExameStats
// =============================================================================
export function useExameStats() {
  const [stats, setStats] = useState<ExameStats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await examesAPI.getStats();
      setStats(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, loading, reload: load };
}

// =============================================================================
// useSolicitacoes — FIX: referências estáveis, sem loop infinito
// =============================================================================
const DEFAULT_SOLICITACAO_FILTERS: SolicitacaoFilters = {
  search: '',
  status: '',
  data_inicio: '',
  data_fim: '',
  limit: 20,
  offset: 0,
};

export function useSolicitacoes(defaultFilters?: Partial<SolicitacaoFilters>) {
  const [items, setItems] = useState<SolicitacaoExame[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SolicitacaoFilters>({
    ...DEFAULT_SOLICITACAO_FILTERS,
    ...defaultFilters,
  });

  // Usar ref para evitar recriação do callback a cada render
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await solicitacoesExamesAPI.list(filtersRef.current);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []); // callback estável — lê de filtersRef

  // Debounce para busca textual
  const debouncedLoad = useMemo(() => debounce(load, 350), [load]);

  // Reload quando filtros mudam (exceto search que é debounced)
  useEffect(() => {
    load();
  }, [filters.status, filters.data_inicio, filters.data_fim, filters.limit, filters.offset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    debouncedLoad();
    return () => debouncedLoad.cancel?.();
  }, [filters.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = useCallback(
    <K extends keyof SolicitacaoFilters>(key: K, value: SolicitacaoFilters[K]) => {
      setFilters((prev) => {
        // Reset offset ao mudar qualquer filtro que não seja o próprio offset
        const resetOffset = key !== 'offset' ? { offset: 0 } : {};
        return { ...prev, [key]: value, ...resetOffset };
      });
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_SOLICITACAO_FILTERS, ...defaultFilters });
  }, [defaultFilters]);

  return { items, loading, filters, setFilter, resetFilters, reload: load };
}

// =============================================================================
// useExamesMaisSolicitados
// =============================================================================
export function useExamesMaisSolicitados(params?: {
  data_inicio?: string;
  data_fim?: string;
  limite?: number;
}) {
  const [data, setData] = useState<ExameMaisSolicitado[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await examesRelatoriosAPI.maisSolicitados(params);
      setData(result);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [params?.data_inicio, params?.data_fim, params?.limite]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, reload: load };
}