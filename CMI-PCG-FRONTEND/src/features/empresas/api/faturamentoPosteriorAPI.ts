/**
 * API Service para Faturamento Posterior
 * @module features/empresas/api/faturamentoPosteriorAPI
 *
 * Endpoints:
 *   GET  /faturamento-posterior/empresas
 *   GET  /faturamento-posterior/empresas/:id/pacientes
 *   GET  /faturamento-posterior/empresas/:id/resumo
 *   PUT  /faturamento-posterior/empresas/:id/config
 *   GET  /faturamento-posterior/empresas/:id/relatorio-pdf
 *   GET  /faturamento-posterior/empresas/:id/recibo-pdf
 */

import api from "@/services/api";
import type {
    Empresa,
    FaturamentoConfig,
    FaturamentoPacientesResponse,
    FaturamentoResumo,
    FaturamentoPeriodo,
} from "../types";

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const faturamentoPosteriorAPI = {
    // ─── Listagem de empresas com faturamento posterior ──────────
    listarEmpresas: async (params?: {
        search?: string;
        ativo?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<{ total: number; empresas: Empresa[] }> =>
        data(api.get("/faturamento-posterior/empresas", { params })),

    // ─── Pacientes com histórico completo no período ────────────
    getPacientesHistorico: async (
        empresaId: number,
        periodo: FaturamentoPeriodo,
    ): Promise<FaturamentoPacientesResponse> =>
        data(
            api.get(`/faturamento-posterior/empresas/${empresaId}/pacientes`, {
                params: periodo,
            }),
        ),

    // ─── Resumo financeiro consolidado ──────────────────────────
    getResumo: async (
        empresaId: number,
        periodo: FaturamentoPeriodo,
    ): Promise<FaturamentoResumo> =>
        data(
            api.get(`/faturamento-posterior/empresas/${empresaId}/resumo`, {
                params: periodo,
            }),
        ),

    // ─── Atualizar configuração de faturamento ──────────────────
    updateConfig: async (
        empresaId: number,
        config: Partial<FaturamentoConfig>,
    ): Promise<{ message: string; empresa: Empresa }> =>
        data(
            api.put(
                `/faturamento-posterior/empresas/${empresaId}/config`,
                config,
            ),
        ),

    // ─── Download de PDF — relatório de atendimentos ────────────
    downloadRelatorio: async (
        empresaId: number,
        periodo: FaturamentoPeriodo,
    ): Promise<Blob> => {
        const response = await api.get(
            `/faturamento-posterior/empresas/${empresaId}/relatorio-pdf`,
            { params: periodo, responseType: "blob" },
        );
        return response.data;
    },

    // ─── Download de PDF — recibo de cobrança ───────────────────
    downloadRecibo: async (
        empresaId: number,
        periodo: FaturamentoPeriodo,
    ): Promise<Blob> => {
        const response = await api.get(
            `/faturamento-posterior/empresas/${empresaId}/recibo-pdf`,
            { params: periodo, responseType: "blob" },
        );
        return response.data;
    },
};