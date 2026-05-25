// src/features/empresas/hooks/useEmpresas.ts
/**
 * React Hooks para Empresas — Módulo Ocupacional
 * @module features/empresas/hooks
 */

import { useState, useEffect, useCallback } from "react";
import { empresasAPI, setoresAPI, cargosAPI, vinculosAPI } from "../api";
import type {
    Empresa,
    EmpresaFilters,
    EmpresaDashboard,
    Setor,
    Cargo,
    Trabalhador,
    VinculoFilters,
    PeriodicoPendente,
} from "../types";

// =============================================================================
// useEmpresas — lista com filtros e paginação
// =============================================================================
export function useEmpresas(initialFilters: EmpresaFilters = {}) {
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<EmpresaFilters>({
        limit: 50,
        ...initialFilters,
    });

    const load = useCallback(
        async (f?: EmpresaFilters) => {
            try {
                setLoading(true);
                setError(null);
                const res = await empresasAPI.list(f ?? filters);
                setEmpresas(res.empresas ?? []);
                setTotal(res.total ?? 0);
            } catch (err: any) {
                setError(err?.response?.data?.error || "Erro ao carregar empresas");
                setEmpresas([]);
            } finally {
                setLoading(false);
            }
        },
        [filters],
    );

    const updateFilters = useCallback((patch: Partial<EmpresaFilters>) => {
        setFilters((prev) => ({ ...prev, ...patch, offset: 0 }));
    }, []);

    useEffect(() => {
        load();
    }, [filters, load]);

    return { empresas, total, loading, error, filters, updateFilters, reload: () => load() };
}

// =============================================================================
// useEmpresa — detalhe por ID
// =============================================================================
export function useEmpresa(id: number | null) {
    const [empresa, setEmpresa] = useState<Empresa | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!id) {
            setEmpresa(null);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            setEmpresa(await empresasAPI.getById(id));
        } catch (err: any) {
            setError(err?.response?.data?.error || "Erro ao carregar empresa");
            setEmpresa(null);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    return { empresa, loading, error, reload: load };
}

// =============================================================================
// useEmpresaDashboard
// =============================================================================
export function useEmpresaDashboard(empresaId: number | null) {
    const [dashboard, setDashboard] = useState<EmpresaDashboard | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        if (!empresaId) return;
        try {
            setLoading(true);
            setDashboard(await empresasAPI.getDashboard(empresaId));
        } catch {
            setDashboard(null);
        } finally {
            setLoading(false);
        }
    }, [empresaId]);

    useEffect(() => {
        load();
    }, [load]);

    return { dashboard, loading, reload: load };
}

// =============================================================================
// useSetores
// =============================================================================
export function useSetores(empresaId: number | null) {
    const [setores, setSetores] = useState<Setor[]>([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        if (!empresaId) return;
        try {
            setLoading(true);
            const res = await setoresAPI.list(empresaId);
            setSetores(res.setores ?? []);
        } catch {
            setSetores([]);
        } finally {
            setLoading(false);
        }
    }, [empresaId]);

    useEffect(() => {
        load();
    }, [load]);

    return { setores, loading, reload: load };
}

// =============================================================================
// useCargos
// =============================================================================
export function useCargos(empresaId: number | null, setorId?: number) {
    const [cargos, setCargos] = useState<Cargo[]>([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        if (!empresaId) return;
        try {
            setLoading(true);
            const params = setorId ? { setor_id: setorId } : undefined;
            const res = await cargosAPI.list(empresaId, params);
            setCargos(res.cargos ?? []);
        } catch {
            setCargos([]);
        } finally {
            setLoading(false);
        }
    }, [empresaId, setorId]);

    useEffect(() => {
        load();
    }, [load]);

    return { cargos, loading, reload: load };
}

// =============================================================================
// useVinculos (UI) — agora lista por /empresas/:id/trabalhadores (novo + legado)
// Mantém o nome do hook para não quebrar componentes.
// =============================================================================
export function useVinculos(empresaId: number | null, initialFilters?: VinculoFilters) {
    const [vinculos, setVinculos] = useState<Trabalhador[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    const [filters, setFilters] = useState<VinculoFilters>({
        status: "ATIVO",
        limit: 50,
        offset: 0,
        ...initialFilters,
    });

    const load = useCallback(async () => {
        if (!empresaId) return;
        try {
            setLoading(true);

            // Regra: enviar "todos" explicitamente; o backend já converte para None.
            const status =
                filters.status === undefined ? undefined : String(filters.status);

            const res = await empresasAPI.getTrabalhadores(empresaId, {
                status,
                search: filters.search,
                limit: filters.limit,
                offset: filters.offset,
            });

            setVinculos(res.trabalhadores ?? []);
            setTotal(res.total ?? 0);
        } catch {
            setVinculos([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [empresaId, filters]);

    const updateFilters = useCallback((patch: Partial<VinculoFilters>) => {
        setFilters((prev) => ({
            ...prev,
            ...patch,
            offset: patch.offset ?? 0,
        }));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return { vinculos, total, loading, filters, updateFilters, reload: load };
}

// =============================================================================
// usePeriodicosPendentes
// =============================================================================
export function usePeriodicosPendentes(empresaId: number | null, dias = 30) {
    const [pendentes, setPendentes] = useState<PeriodicoPendente[]>([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        if (!empresaId) return;
        try {
            setLoading(true);
            const res = await empresasAPI.getPeriodicosPendentes(empresaId, dias);
            setPendentes(res.pendentes ?? []);
        } catch {
            setPendentes([]);
        } finally {
            setLoading(false);
        }
    }, [empresaId, dias]);

    useEffect(() => {
        load();
    }, [load]);

    return { pendentes, loading, reload: load };
}

// =============================================================================
// useEmpresaMutations — CRUD
// =============================================================================
export function useEmpresaMutations() {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = async <T,>(fn: () => Promise<T>): Promise<T> => {
        try {
            setSaving(true);
            setError(null);
            return await fn();
        } catch (err: any) {
            const msg = err?.response?.data?.error || "Erro na operação";
            setError(msg);
            throw new Error(msg);
        } finally {
            setSaving(false);
        }
    };

    return {
        saving,
        error,
        // Empresa
        createEmpresa: (d: any) => run(() => empresasAPI.create(d)),
        updateEmpresa: (id: number, d: any) => run(() => empresasAPI.update(id, d)),
        deleteEmpresa: (id: number) => run(() => empresasAPI.delete(id)),
        // Setor
        createSetor: (eid: number, d: any) => run(() => setoresAPI.create(eid, d)),
        updateSetor: (eid: number, sid: number, d: any) =>
            run(() => setoresAPI.update(eid, sid, d)),
        deleteSetor: (eid: number, sid: number) => run(() => setoresAPI.delete(eid, sid)),
        // Cargo
        createCargo: (eid: number, d: any) => run(() => cargosAPI.create(eid, d)),
        updateCargo: (eid: number, cid: number, d: any) =>
            run(() => cargosAPI.update(eid, cid, d)),
        deleteCargo: (eid: number, cid: number) => run(() => cargosAPI.delete(eid, cid)),
        // Vínculo (mutations continuam no endpoint antigo)
        createVinculo: (eid: number, d: any) => run(() => vinculosAPI.create(eid, d)),
        updateVinculo: (vid: number, d: any) => run(() => vinculosAPI.update(vid, d)),
        desligarVinculo: (vid: number, dt: string) => run(() => vinculosAPI.desligar(vid, dt)),
        reativarVinculo: (vid: number) => run(() => vinculosAPI.reativar(vid)),
    };
}