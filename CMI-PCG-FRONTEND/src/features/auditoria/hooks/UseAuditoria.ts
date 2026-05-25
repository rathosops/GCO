/**
 * Hooks para o módulo de Auditoria v2
 *
 * - useAuditLogs: lista paginada com filtros
 * - useAuditInsights: insights narrativos + gráficos
 * - useAuditResources: lista de recursos com labels
 * - useAuditLogDetail: detalhe completo de um log (lazy)
 * - useResourceHistory: timeline de alterações de uma entidade
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { auditoriaAPI } from '../api';
import { debounce } from '@/utils/debounce';
import type {
    AuditLog,
    AuditLogFilters,
    AuditResource,
    AuditInsightsResponse,
    ResourceHistoryResponse,
} from '../types';

// =============================================================================
// useAuditLogs — lista paginada com filtros
// =============================================================================

const DEFAULT_FILTERS: AuditLogFilters = {
    action: '',
    resource: '',
    date_from: '',
    date_to: '',
    limit: 30,
    offset: 0,
    compact: true,
};

export function useAuditLogs(defaultFilters?: Partial<AuditLogFilters>) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPageInternal] = useState(0);
    const pageSize = 30;

    const [filters, setFilters] = useState<AuditLogFilters>({
        ...DEFAULT_FILTERS,
        ...defaultFilters,
    });

    const filtersRef = useRef(filters);
    filtersRef.current = filters;

    const pageRef = useRef(page);
    pageRef.current = page;

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const result = await auditoriaAPI.list({
                ...filtersRef.current,
                offset: pageRef.current * pageSize,
                limit: pageSize,
            });

            setLogs(result.logs);
            setTotal(result.total);
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Erro ao carregar logs');
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const debouncedLoad = useMemo(() => debounce(load, 300), [load]);

    useEffect(() => {
        load();
    }, [filters.action, filters.resource, filters.date_from, filters.date_to, page]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        debouncedLoad();
        return () => debouncedLoad.cancel?.();
    }, [filters.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

    const setFilter = useCallback(
        <K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) => {
            setFilters((prev) => ({ ...prev, [key]: value }));
            if (key !== 'offset') setPageInternal(0);
        },
        [],
    );

    const setPage = useCallback((p: number) => setPageInternal(Math.max(0, p)), []);

    const resetFilters = useCallback(() => {
        setFilters({ ...DEFAULT_FILTERS, ...defaultFilters });
        setPageInternal(0);
    }, [defaultFilters]);

    const totalPages = Math.ceil(total / pageSize);
    const hasMore = page + 1 < totalPages;

    return {
        logs, total, loading, error, filters,
        setFilter, resetFilters, reload: load,
        page, setPage, pageSize, totalPages, hasMore,
    };
}

// =============================================================================
// useAuditInsights
// =============================================================================

export function useAuditInsights(days = 30) {
    const [insights, setInsights] = useState<AuditInsightsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await auditoriaAPI.getInsights(days);
            setInsights(data);
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Erro ao carregar insights');
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => { load(); }, [load]);

    return { insights, loading, error, reload: load };
}

// =============================================================================
// useAuditResources — agora retorna {key, label}
// =============================================================================

export function useAuditResources() {
    const [resources, setResources] = useState<AuditResource[]>([]);

    useEffect(() => {
        let cancelled = false;
        auditoriaAPI.getResources()
            .then((data) => {
                if (cancelled) return;
                // Compatibilidade: backend novo retorna {key, label}, antigo retorna string[]
                const list = data.resources as any[];
                if (list.length && typeof list[0] === 'string') {
                    setResources(list.map((r: string) => ({ key: r, label: r })));
                } else {
                    setResources(list);
                }
            })
            .catch(() => { });
        return () => { cancelled = true; };
    }, []);

    return { resources };
}

// =============================================================================
// useAuditLogDetail — carrega detalhe completo de um log (lazy, sob demanda)
// =============================================================================

export function useAuditLogDetail() {
    const [detail, setDetail] = useState<AuditLog | null>(null);
    const [loading, setLoading] = useState(false);
    const cache = useRef<Map<number, AuditLog>>(new Map());

    const load = useCallback(async (id: number) => {
        // Cache hit
        if (cache.current.has(id)) {
            setDetail(cache.current.get(id)!);
            return;
        }

        try {
            setLoading(true);
            const data = await auditoriaAPI.getById(id);
            cache.current.set(id, data);
            setDetail(data);
        } catch {
            setDetail(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const clear = useCallback(() => setDetail(null), []);

    return { detail, loading, load, clear };
}

// =============================================================================
// useResourceHistory — timeline de uma entidade
// =============================================================================

export function useResourceHistory() {
    const [history, setHistory] = useState<ResourceHistoryResponse | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async (resource: string, resourceId: string) => {
        try {
            setLoading(true);
            const data = await auditoriaAPI.getHistory(resource, resourceId);
            setHistory(data);
        } catch {
            setHistory(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const clear = useCallback(() => setHistory(null), []);

    return { history, loading, load, clear };
}