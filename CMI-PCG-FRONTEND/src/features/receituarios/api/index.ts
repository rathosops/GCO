/**
 * API Service para Receituários Médicos
 * @module features/receituarios/api
 */

import api from "@/services/api";
import type {
  Receituario,
  ReceituarioCreatePayload,
  ReceituarioUpdatePayload,
  ReceituarioFilters,
  ReceituarioStats,
  DispensarItemPayload,
} from "../types";

const data = <T>(promise: Promise<{ data: T }>) => promise.then((r) => r.data);

// =============================================================================
// CRUD
// =============================================================================

export const receituariosAPI = {
  /**
   * Lista receituários com filtros
   */
  list: async (filters?: ReceituarioFilters): Promise<Receituario[]> => {
    const params: Record<string, unknown> = {};
    if (filters?.cpf_paciente) params.cpf_paciente = filters.cpf_paciente;
    if (filters?.crm_medico) params.crm_medico = filters.crm_medico;
    if (filters?.tipo_receita) params.tipo_receita = filters.tipo_receita;
    if (filters?.status) params.status = filters.status;
    if (filters?.data_inicio) params.data_inicio = filters.data_inicio;
    if (filters?.data_fim) params.data_fim = filters.data_fim;
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.offset) params.offset = filters.offset;
    return data(api.get("/receituarios", { params }));
  },

  /**
   * Busca receituário por ID (com itens)
   */
  getById: async (id: number): Promise<Receituario> =>
    data(api.get(`/receituarios/${id}`)),

  /**
   * Cria novo receituário
   */
  create: async (
    payload: ReceituarioCreatePayload
  ): Promise<{ message: string; data: Receituario }> =>
    data(api.post("/receituarios", payload)),

  /**
   * Atualiza observações/orientações
   */
  update: async (
    id: number,
    payload: ReceituarioUpdatePayload
  ): Promise<{ message: string; data: Receituario }> =>
    data(api.put(`/receituarios/${id}`, payload)),

  /**
   * Cancela receituário (soft delete com motivo)
   */
  cancel: async (
    id: number,
    motivo: string
  ): Promise<{ message: string }> =>
    data(api.delete(`/receituarios/${id}`, { data: { motivo } })),

  // ===========================================================================
  // Dispensação
  // ===========================================================================

  /**
   * Dispensa item do receituário via estoque (FEFO)
   */
  dispensarItem: async (
    receituarioId: number,
    itemId: number,
    payload?: DispensarItemPayload
  ): Promise<{ message: string; data: Receituario }> =>
    data(
      api.post(
        `/receituarios/${receituarioId}/dispensar/${itemId}`,
        payload ?? {}
      )
    ),

  // ===========================================================================
  // Consultas específicas
  // ===========================================================================

  /**
   * Receituários de um paciente
   */
  getByPaciente: async (cpf: string): Promise<Receituario[]> =>
    data(api.get(`/receituarios/paciente/${cpf}`)),

  /**
   * Receituários de um médico
   */
  getByMedico: async (crm: string | number): Promise<Receituario[]> =>
    data(api.get(`/receituarios/medico/${crm}`)),

  /**
   * Tipos disponíveis (lookup)
   */
  getTipos: async (): Promise<{
    tipos: { codigo: string; descricao: string; validade_dias: number; vias: number }[];
  }> => data(api.get("/receituarios/tipos")),

  /**
   * Estatísticas
   */
  getStats: async (): Promise<ReceituarioStats> =>
    data(api.get("/receituarios/stats")),

  // ===========================================================================
  // PDF
  // ===========================================================================

  /**
   * Download do PDF do receituário
   */
  downloadPdf: async (id: number): Promise<Blob> => {
    const res = await api.get(`/receituarios/${id}/pdf`, {
      params: { download: true },
      responseType: "blob",
      timeout: 30000,
    });
    return res.data;
  },

  /**
   * Visualizar PDF inline
   */
  viewPdf: async (id: number): Promise<Blob> => {
    const res = await api.get(`/receituarios/${id}/pdf`, {
      responseType: "blob",
      timeout: 30000,
    });
    return res.data;
  },

  /**
   * HTML preview do receituário
   */
  getHtmlPreview: async (id: number): Promise<string> => {
    const res = await api.get(`/receituarios/${id}/pdf/html`, {
      params: { raw: true },
      responseType: "text",
    });
    return res.data;
  },
};

export default receituariosAPI;