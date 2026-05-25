/**
 * API Service para Empresas — Módulo Ocupacional
 * @module features/empresas/api
 */

import api from "@/services/api";
import type {
    Empresa,
    EmpresaFilters,
    EmpresaDashboard,
    Setor,
    SetorFormData,
    Cargo,
    CargoFormData,
    Vinculo,
    VinculoFilters,
    VinculoFormData,
    PeriodicoPendente,
    AsoPrefill,
    Trabalhador,
} from "../types";

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

// =============================================================================
// Adapters (backend -> frontend UI types)
// =============================================================================

type BackendDashboard = {
    empresa?: { id?: number; nome?: string };
    totais?: {
        trabalhadores_total?: number;
        trabalhadores_ativos?: number;
        setores?: number;
        cargos?: number;
        asos_emitidos?: number;
    };
};

function adaptDashboard(payload: BackendDashboard): EmpresaDashboard {
    const empresaId = payload?.empresa?.id ?? 0;
    const empresaNome = payload?.empresa?.nome ?? "";
    const totais = payload?.totais ?? {};

    return {
        empresa_id: empresaId,
        empresa_nome: empresaNome,
        total_trabalhadores: totais.trabalhadores_total ?? 0,
        ativos: totais.trabalhadores_ativos ?? 0,
        total_setores: totais.setores ?? 0,
        total_cargos: totais.cargos ?? 0,
        total_asos_emitidos: totais.asos_emitidos ?? 0,
    };
}

type BackendPeriodicoItem = {
    vinculo?: any; // VinculosEmpregado.to_dict(include_relations=True)
    ultimo_aso_data?: string | null;
    vencimento?: string;
    dias_para_vencer?: number;
    vencido?: boolean;
    periodicidade_meses?: number;
};

type BackendPeriodicosResponse = {
    empresa_id: number;
    empresa_nome: string;
    dias_antecedencia: number;
    total: number;
    pendentes: BackendPeriodicoItem[];
};

function adaptPeriodicos(
    payload: BackendPeriodicosResponse,
): {
    empresa_id: number;
    empresa_nome: string;
    dias_antecedencia: number;
    total: number;
    pendentes: PeriodicoPendente[];
} {
    const pendentes: PeriodicoPendente[] = (payload?.pendentes ?? []).map((p) => {
        const v = p?.vinculo ?? {};
        return {
            vinculo_id: v.id ?? 0,
            paciente_id: v.paciente_id ?? v.paciente?.id ?? 0,
            paciente_nome: v.paciente_nome ?? v.paciente?.nome ?? "—",
            funcao: v.funcao ?? "—",
            cargo_nome: v.cargo_nome ?? v.cargo?.nome,
            setor_nome: v.setor_nome ?? v.setor?.nome,
            ultimo_aso_data: p.ultimo_aso_data ?? null,
            periodicidade_meses: p.periodicidade_meses ?? 12,
            data_vencimento: p.vencimento ?? "",
            dias_para_vencer: p.dias_para_vencer ?? 0,
            vencido: Boolean(p.vencido),
        };
    });

    return {
        empresa_id: payload.empresa_id,
        empresa_nome: payload.empresa_nome,
        dias_antecedencia: payload.dias_antecedencia,
        total: payload.total,
        pendentes,
    };
}

type BackendAsoPrefill = {
    paciente?: { id: number; nome: string; cpf: string };
    empresa?: { id: number; nome: string; cnpj: string; razao_social?: string };
    funcao_do_paciente?: string;
    setor?: string;
    riscos?: any;
    exames_sugeridos?: any;
    nrs?: any;
    manipulacao_de_alimentos?: string; // "Sim" | ""
    vinculo_id?: number;
    matricula?: string | null;
};

function adaptAsoPrefill(payload: BackendAsoPrefill): AsoPrefill {
    return {
        empresa: {
            id: payload?.empresa?.id ?? 0,
            nome: payload?.empresa?.nome ?? "",
            cnpj: String(payload?.empresa?.cnpj ?? ""),
        },
        paciente: {
            id: payload?.paciente?.id ?? 0,
            nome: payload?.paciente?.nome ?? "",
            cpf: String(payload?.paciente?.cpf ?? ""),
        },
        vinculo: {
            funcao: payload?.funcao_do_paciente ?? "",
            matricula: payload?.matricula ?? undefined,
            setor: payload?.setor ?? undefined,
            cargo: undefined,
            manipula_alimentos: payload?.manipulacao_de_alimentos === "Sim",
        },
        riscos_ocupacionais: payload?.riscos ?? {},
        exames_sugeridos: payload?.exames_sugeridos ?? {},
        nrs_aplicaveis: payload?.nrs ?? {},
    };
}

// =============================================================================
// Empresas
// =============================================================================

export const empresasAPI = {
    list: async (
        filters?: EmpresaFilters,
    ): Promise<{ total: number; empresas: Empresa[] }> => {
        const params: Record<string, unknown> = {};
        if (filters?.search) params.search = filters.search;
        if (filters?.cnae) params.cnae = filters.cnae;
        if (filters?.grau_risco) params.grau_risco = filters.grau_risco;
        if (filters?.cidade) params.cidade = filters.cidade;
        if (filters?.uf) params.uf = filters.uf;
        if (filters?.ativo !== undefined && filters.ativo !== "")
            params.ativo = filters.ativo;
        if (filters?.compact) params.compact = true;
        if (filters?.limit) params.limit = filters.limit;
        if (filters?.offset) params.offset = filters.offset;
        return data(api.get("/empresas", { params }));
    },

    getById: async (id: number): Promise<Empresa> => data(api.get(`/empresas/${id}`)),

    getByCnpj: async (cnpj: string): Promise<Empresa> =>
        data(api.get(`/empresas/cnpj/${cnpj}`)),

    create: async (
        payload: Partial<Empresa>,
    ): Promise<{ message: string; empresa: Empresa }> => data(api.post("/empresas", payload)),

    update: async (
        id: number,
        payload: Partial<Empresa>,
    ): Promise<{ message: string; empresa: Empresa }> =>
        data(api.put(`/empresas/${id}`, payload)),

    delete: async (id: number): Promise<{ message: string }> =>
        data(api.delete(`/empresas/${id}`)),

    getStats: async (): Promise<{
        total: number;
        ativas: number;
        inativas: number;
        por_grau_risco: Record<string, number>;
        top_empresas: { id: number; nome: string; trabalhadores_ativos: number }[];
    }> => data(api.get("/empresas/stats")),

    /**
     * Backend retorna {empresa, totais}. Adapter normaliza para EmpresaDashboard da UI.
     */
    getDashboard: async (id: number): Promise<EmpresaDashboard> => {
        const raw = await data<BackendDashboard>(api.get(`/empresas/${id}/dashboard`));
        return adaptDashboard(raw);
    },

    /**
     * Endpoint novo (backend): /empresas/:id/trabalhadores
     * Importante para suportar "novo + legado".
     */
    getTrabalhadores: async (
        id: number,
        params?: { status?: string; search?: string; limit?: number; offset?: number },
    ): Promise<{ total: number; trabalhadores: Trabalhador[]; limit: number; offset: number }> => {
        const raw = await data<{
            total: number;
            limit: number;
            offset: number;
            trabalhadores: any[];
        }>(api.get(`/empresas/${id}/trabalhadores`, { params }));

        // Heurística: se vier item sem campos típicos de vínculo, marca como LEGADO.
        const trabalhadores: Trabalhador[] = (raw.trabalhadores ?? []).map((t) => {
            const hasVinculoShape = typeof t?.status === "string" && typeof t?.funcao === "string";
            if (hasVinculoShape) return t as Trabalhador;

            // legado
            return {
                id: Number(t?.id ?? t?.paciente_id ?? 0),
                paciente_id: Number(t?.paciente_id ?? t?.paciente?.id ?? 0),
                empresa_id: Number(t?.empresa_id ?? id),
                status: "LEGADO",
                paciente_nome: t?.paciente_nome ?? t?.paciente?.nome,
                paciente_cpf: t?.paciente_cpf ?? t?.paciente?.cpf,
                empresa_nome: t?.empresa_nome ?? t?.empresa?.nome,
                funcao: t?.funcao ?? null,
                data_admissao: t?.data_admissao ?? null,
                matricula: t?.matricula ?? null,
                cargo_nome: t?.cargo_nome ?? t?.cargo?.nome ?? null,
                setor_nome: t?.setor_nome ?? t?.setor?.nome ?? null,
            };
        });

        return { total: raw.total ?? 0, limit: raw.limit ?? 50, offset: raw.offset ?? 0, trabalhadores };
    },

    /**
     * Backend retorna pendentes com shape diferente. Adapter normaliza.
     */
    getPeriodicosPendentes: async (
        id: number,
        dias?: number,
    ): Promise<{
        empresa_id: number;
        empresa_nome: string;
        dias_antecedencia: number;
        total: number;
        pendentes: PeriodicoPendente[];
    }> => {
        const raw = await data<BackendPeriodicosResponse>(
            api.get(`/empresas/${id}/periodicos`, { params: dias ? { dias } : {} }),
        );
        return adaptPeriodicos(raw);
    },

    /**
     * Backend retorna um payload de prefill diferente do tipo do frontend.
     */
    getAsoPrefill: async (empresaId: number, vinculoId: number): Promise<AsoPrefill> => {
        const raw = await data<BackendAsoPrefill>(
            api.get(`/empresas/${empresaId}/aso-prefill/${vinculoId}`),
        );
        return adaptAsoPrefill(raw);
    },
};

// =============================================================================
// Setores
// =============================================================================

export const setoresAPI = {
    list: async (
        empresaId: number,
        params?: { ativo?: boolean; search?: string },
    ): Promise<{ empresa_id: number; total: number; setores: Setor[] }> =>
        data(api.get(`/empresas/${empresaId}/setores`, { params })),

    getById: async (empresaId: number, setorId: number): Promise<Setor> =>
        data(api.get(`/empresas/${empresaId}/setores/${setorId}`)),

    create: async (
        empresaId: number,
        payload: SetorFormData,
    ): Promise<{ message: string; setor: Setor }> =>
        data(api.post(`/empresas/${empresaId}/setores`, payload)),

    update: async (
        empresaId: number,
        setorId: number,
        payload: Partial<SetorFormData & { ativo?: boolean }>,
    ): Promise<{ message: string; setor: Setor }> =>
        data(api.put(`/empresas/${empresaId}/setores/${setorId}`, payload)),

    delete: async (
        empresaId: number,
        setorId: number,
    ): Promise<{ message: string; soft_delete: boolean }> =>
        data(api.delete(`/empresas/${empresaId}/setores/${setorId}`)),
};

// =============================================================================
// Cargos
// =============================================================================

export const cargosAPI = {
    list: async (
        empresaId: number,
        params?: { ativo?: boolean; setor_id?: number; search?: string },
    ): Promise<{ empresa_id: number; total: number; cargos: Cargo[] }> =>
        data(api.get(`/empresas/${empresaId}/cargos`, { params })),

    getById: async (empresaId: number, cargoId: number): Promise<Cargo> =>
        data(api.get(`/empresas/${empresaId}/cargos/${cargoId}`)),

    create: async (
        empresaId: number,
        payload: Partial<CargoFormData>,
    ): Promise<{ message: string; cargo: Cargo }> =>
        data(api.post(`/empresas/${empresaId}/cargos`, payload)),

    update: async (
        empresaId: number,
        cargoId: number,
        payload: Partial<CargoFormData & { ativo?: boolean }>,
    ): Promise<{ message: string; cargo: Cargo }> =>
        data(api.put(`/empresas/${empresaId}/cargos/${cargoId}`, payload)),

    delete: async (
        empresaId: number,
        cargoId: number,
    ): Promise<{ message: string; soft_delete: boolean }> =>
        data(api.delete(`/empresas/${empresaId}/cargos/${cargoId}`)),
};

// =============================================================================
// Vínculos (CRUD continua igual)
// =============================================================================

export const vinculosAPI = {
    listByEmpresa: async (
        empresaId: number,
        filters?: VinculoFilters,
    ): Promise<{ empresa_id: number; total: number; vinculos: Vinculo[] }> => {
        const params: Record<string, unknown> = {};
        if (filters?.status) params.status = filters.status;
        if (filters?.cargo_id) params.cargo_id = filters.cargo_id;
        if (filters?.setor_id) params.setor_id = filters.setor_id;
        if (filters?.search) params.search = filters.search;
        if (filters?.limit) params.limit = filters.limit;
        if (filters?.offset) params.offset = filters.offset;
        return data(api.get(`/empresas/${empresaId}/vinculos`, { params }));
    },

    listByPaciente: async (pacienteId: number): Promise<{
        paciente_id: number;
        paciente_nome: string;
        total: number;
        vinculos: Vinculo[];
    }> => data(api.get(`/pacientes/${pacienteId}/vinculos`)),

    getById: async (vinculoId: number): Promise<Vinculo> =>
        data(api.get(`/vinculos/${vinculoId}`)),

    create: async (
        empresaId: number,
        payload: Partial<VinculoFormData>,
    ): Promise<{ message: string; vinculo: Vinculo }> =>
        data(api.post(`/empresas/${empresaId}/vinculos`, payload)),

    update: async (
        vinculoId: number,
        payload: Partial<Vinculo>,
    ): Promise<{ message: string; vinculo: Vinculo }> =>
        data(api.put(`/vinculos/${vinculoId}`, payload)),

    desligar: async (
        vinculoId: number,
        data_desligamento: string,
    ): Promise<{ message: string; vinculo: Vinculo }> =>
        data(api.put(`/vinculos/${vinculoId}/desligar`, { data_desligamento })),

    reativar: async (vinculoId: number): Promise<{ message: string; vinculo: Vinculo }> =>
        data(api.put(`/vinculos/${vinculoId}/reativar`, {})),
};

export default {
    empresas: empresasAPI,
    setores: setoresAPI,
    cargos: cargosAPI,
    vinculos: vinculosAPI,
};