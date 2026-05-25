/**
 * React Hooks para Faturamento Posterior
 * @module features/empresas/hooks/useFaturamentoPosterior
 */

import { useState, useEffect, useCallback } from "react";
import { faturamentoPosteriorAPI } from "../api/faturamentoPosteriorAPI";
import type {
    Empresa,
    FaturamentoConfig,
    FaturamentoPacientesResponse,
    FaturamentoResumo,
    FaturamentoPeriodo,
} from "../types";

// =============================================================================
// Helpers
// =============================================================================

/** Retorna primeiro e último dia do mês atual no formato YYYY-MM-DD */
function getCurrentMonthPeriod(): FaturamentoPeriodo {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0); // último dia do mês
    return {
        data_inicio: start.toISOString().split("T")[0],
        data_fim: end.toISOString().split("T")[0],
    };
}

/** Faz download de um Blob como arquivo */
function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =============================================================================
// useFaturamentoEmpresas — lista de empresas com faturamento posterior
// =============================================================================

export function useFaturamentoEmpresas(initialSearch = "") {
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState(initialSearch);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await faturamentoPosteriorAPI.listarEmpresas({
                search: search || undefined,
                limit: 100,
            });
            setEmpresas(res.empresas ?? []);
            setTotal(res.total ?? 0);
        } catch (err: any) {
            setError(err?.response?.data?.error || "Erro ao carregar empresas");
            setEmpresas([]);
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        load();
    }, [load]);

    return { empresas, total, loading, error, search, setSearch, reload: load };
}

// =============================================================================
// useFaturamentoDetalhe — histórico de pacientes + resumo de uma empresa
// =============================================================================

export function useFaturamentoDetalhe(empresaId: number | null) {
    const [periodo, setPeriodo] = useState<FaturamentoPeriodo>(getCurrentMonthPeriod);
    const [historico, setHistorico] = useState<FaturamentoPacientesResponse | null>(null);
    const [resumo, setResumo] = useState<FaturamentoResumo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!empresaId) return;
        try {
            setLoading(true);
            setError(null);
            const [hist, res] = await Promise.all([
                faturamentoPosteriorAPI.getPacientesHistorico(empresaId, periodo),
                faturamentoPosteriorAPI.getResumo(empresaId, periodo).catch(() => null),
            ]);
            setHistorico(hist);
            setResumo(res);
        } catch (err: any) {
            setError(err?.response?.data?.error || "Erro ao carregar dados");
            setHistorico(null);
            setResumo(null);
        } finally {
            setLoading(false);
        }
    }, [empresaId, periodo]);

    useEffect(() => {
        load();
    }, [load]);

    return { historico, resumo, periodo, setPeriodo, loading, error, reload: load };
}

// =============================================================================
// useFaturamentoMutations — config + download PDFs
// =============================================================================

export function useFaturamentoMutations() {
    const [saving, setSaving] = useState(false);
    const [downloading, setDownloading] = useState(false);
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

    const updateConfig = (empresaId: number, config: Partial<FaturamentoConfig>) =>
        run(() => faturamentoPosteriorAPI.updateConfig(empresaId, config));

    const downloadRelatorio = async (empresaId: number, periodo: FaturamentoPeriodo, nomeEmpresa: string) => {
        try {
            setDownloading(true);
            const blob = await faturamentoPosteriorAPI.downloadRelatorio(empresaId, periodo);
            const filename = `relatorio_faturamento_${nomeEmpresa.replace(/\s+/g, "_")}_${periodo.data_inicio}_${periodo.data_fim}.pdf`;
            downloadBlob(blob, filename);
        } catch (err: any) {
            const msg = err?.response?.data?.error || "Erro ao gerar relatório";
            setError(msg);
            throw new Error(msg);
        } finally {
            setDownloading(false);
        }
    };

    const downloadRecibo = async (empresaId: number, periodo: FaturamentoPeriodo, nomeEmpresa: string) => {
        try {
            setDownloading(true);
            const blob = await faturamentoPosteriorAPI.downloadRecibo(empresaId, periodo);
            const filename = `recibo_cobranca_${nomeEmpresa.replace(/\s+/g, "_")}_${periodo.data_inicio}_${periodo.data_fim}.pdf`;
            downloadBlob(blob, filename);
        } catch (err: any) {
            const msg = err?.response?.data?.error || "Erro ao gerar recibo";
            setError(msg);
            throw new Error(msg);
        } finally {
            setDownloading(false);
        }
    };

    return { saving, downloading, error, updateConfig, downloadRelatorio, downloadRecibo };
}