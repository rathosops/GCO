/**
 * API Service para Perícias IMESC
 */

import api from "@/services/api";
import type {
  PericiaIMESC,
  PericiaFormData,
  ParecerSocialData,
  ParecerMedicoData,
  PericiaFilters,
  PericiaStats,
  AssistenteSocial,
  AssistenteSocialAutocomplete,
} from "../types";

const data = <T>(promise: Promise<{ data: T }>) => promise.then((r) => r.data);

// =============================================================================
// Perícias IMESC API
// =============================================================================
export const periciasImescAPI = {
  list: async (filters?: PericiaFilters): Promise<PericiaIMESC[]> => {
    const params: Record<string, unknown> = {};
    if (filters?.protocolo) params.protocolo = filters.protocolo;
    if (filters?.cpf_paciente) params.cpf_paciente = filters.cpf_paciente;
    if (filters?.status) params.status = filters.status;
    if (filters?.data_inicio) params.data_inicio = filters.data_inicio;
    if (filters?.data_fim) params.data_fim = filters.data_fim;
    if (filters?.search) params.search = filters.search;
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.offset) params.offset = filters.offset;

    return data(api.get("/pericias-imesc", { params }));
  },

  getById: async (id: number): Promise<PericiaIMESC> => {
    return data(api.get(`/pericias-imesc/${id}`));
  },

  create: async (
    payload: PericiaFormData
  ): Promise<{ message: string; pericia: PericiaIMESC }> => {
    return data(api.post("/pericias-imesc", payload));
  },

  update: async (
    id: number,
    payload: Partial<PericiaFormData>
  ): Promise<{ message: string; pericia: PericiaIMESC }> => {
    return data(api.put(`/pericias-imesc/${id}`, payload));
  },

  delete: async (id: number): Promise<{ message: string }> => {
    return data(api.delete(`/pericias-imesc/${id}`));
  },

  registrarParecerSocial: async (
    id: number,
    payload: ParecerSocialData
  ): Promise<{ message: string; pericia: PericiaIMESC }> => {
    return data(api.patch(`/pericias-imesc/${id}/parecer-social`, payload));
  },

  registrarParecerMedico: async (
    id: number,
    payload: ParecerMedicoData
  ): Promise<{ message: string; pericia: PericiaIMESC }> => {
    return data(api.patch(`/pericias-imesc/${id}/parecer-medico`, payload));
  },

  getStats: async (): Promise<PericiaStats> => {
    return data(api.get("/pericias-imesc/stats"));
  },

  downloadPdf: async (id: number): Promise<Blob> => {
    const response = await api.get(`/pericias-imesc/${id}/pdf`, {
      responseType: "blob",
    });
    return response.data;
  },
};

// =============================================================================
// Assistentes Sociais API
// =============================================================================
export const assistentesSociaisAPI = {
  list: async (params?: {
    search?: string;
    nome?: string;
    cress?: string;
    cpf?: string;
    ativo?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<AssistenteSocial[]> => {
    return data(api.get("/assistentes-sociais", { params }));
  },

  getById: async (id: number): Promise<AssistenteSocial> => {
    return data(api.get(`/assistentes-sociais/${id}`));
  },

  getByCress: async (cress: string): Promise<AssistenteSocial> => {
    return data(api.get(`/assistentes-sociais/cress/${cress}`));
  },

  create: async (
    payload: Partial<AssistenteSocial>
  ): Promise<{ message: string; assistente_social: AssistenteSocial }> => {
    return data(api.post("/assistentes-sociais", payload));
  },

  update: async (
    id: number,
    payload: Partial<AssistenteSocial>
  ): Promise<{ message: string; assistente_social: AssistenteSocial }> => {
    return data(api.put(`/assistentes-sociais/${id}`, payload));
  },

  delete: async (id: number): Promise<{ message: string }> => {
    return data(api.delete(`/assistentes-sociais/${id}`));
  },

  autocomplete: async (q?: string): Promise<AssistenteSocialAutocomplete[]> => {
    const params: Record<string, string> = {};
    if (q) params.q = q;

    const response = await api.get("/assistentes-sociais/autocomplete", { params });
    const raw = response.data as unknown;

    let list: unknown = raw;
    if (!Array.isArray(list) && list && typeof list === "object") {
      const obj = list as Record<string, unknown>;
      list =
        obj.items ??
        obj.results ??
        obj.data ??
        obj.assistentes ??
        obj.assistentes_sociais ??
        obj.assistentesSociais ??
        [];
    }

    const arr = Array.isArray(list)
      ? (list as AssistenteSocialAutocomplete[])
      : [];

    return arr
      .filter((a) => a && (a.ativo === undefined || a.ativo === true))
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  },
};

export default periciasImescAPI;
