/**
 * API Service para Farmácia / Controle de Estoque
 * @module features/farmacia/api
 */

import api from "@/services/api";
import type {
  Fornecedor,
  FornecedorFormData,
  FornecedorFilters,
  Medicamento,
  MedicamentoFormData,
  MedicamentoFilters,
  MedicamentoAutocomplete,
  ClassificacoesResponse,
  Lote,
  LoteFormData,
  Movimentacao,
  MovimentacaoFilters,
  DispensacaoFormData,
  DispensacaoLoteFormData,
  AlertaEstoque,
  DashboardEstoque,
  VencimentosPorCor,
  MotivoDescarte,
} from "../types";

const data = <T>(promise: Promise<{ data: T }>) => promise.then((r) => r.data);

// =============================================================================
// Fornecedores API
// =============================================================================
export const fornecedoresAPI = {
  list: async (filters?: FornecedorFilters): Promise<Fornecedor[]> => {
    const params: Record<string, unknown> = {};
    if (filters?.search) params.search = filters.search;
    if (filters?.ativo !== undefined && filters.ativo !== "")
      params.ativo = filters.ativo;
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.offset) params.offset = filters.offset;
    return data(api.get("/fornecedores", { params }));
  },

  getById: async (id: number): Promise<Fornecedor> =>
    data(api.get(`/fornecedores/${id}`)),

  create: async (
    payload: FornecedorFormData
  ): Promise<{ message: string; data: Fornecedor }> =>
    data(api.post("/fornecedores", payload)),

  update: async (
    id: number,
    payload: Partial<FornecedorFormData>
  ): Promise<{ message: string; data: Fornecedor }> =>
    data(api.put(`/fornecedores/${id}`, payload)),

  delete: async (id: number): Promise<{ message: string }> =>
    data(api.delete(`/fornecedores/${id}`)),
};

// =============================================================================
// Medicamentos API
// =============================================================================
export const medicamentosAPI = {
  list: async (filters?: MedicamentoFilters): Promise<Medicamento[]> => {
    const params: Record<string, unknown> = {};
    if (filters?.search) params.search = filters.search;
    if (filters?.classificacao_anvisa)
      params.classificacao_anvisa = filters.classificacao_anvisa;
    if (filters?.controlado !== undefined && filters.controlado !== "")
      params.controlado = filters.controlado;
    if (filters?.forma_farmaceutica)
      params.forma_farmaceutica = filters.forma_farmaceutica;
    if (filters?.ativo !== undefined && filters.ativo !== "")
      params.ativo = filters.ativo;
    if (filters?.include_estoque !== undefined)
      params.include_estoque = filters.include_estoque;
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.offset) params.offset = filters.offset;
    return data(api.get("/medicamentos", { params }));
  },

  getById: async (id: number): Promise<Medicamento & { lotes: Lote[] }> =>
    data(api.get(`/medicamentos/${id}`)),

  create: async (
    payload: MedicamentoFormData
  ): Promise<{ message: string; data: Medicamento }> =>
    data(api.post("/medicamentos", payload)),

  update: async (
    id: number,
    payload: Partial<MedicamentoFormData>
  ): Promise<{ message: string; data: Medicamento }> =>
    data(api.put(`/medicamentos/${id}`, payload)),

  delete: async (id: number): Promise<{ message: string }> =>
    data(api.delete(`/medicamentos/${id}`)),

  getClassificacoes: async (): Promise<ClassificacoesResponse> =>
    data(api.get("/medicamentos/classificacoes")),

  autocomplete: async (q: string): Promise<MedicamentoAutocomplete[]> =>
    data(api.get("/medicamentos/autocomplete", { params: { q } })),
};

// =============================================================================
// Lotes API
// =============================================================================
export const lotesAPI = {
  listByMedicamento: async (
    medId: number,
    params?: { ativo?: boolean; disponivel?: boolean }
  ): Promise<{ medicamento: Medicamento; lotes: Lote[]; total_lotes: number }> =>
    data(api.get(`/medicamentos/${medId}/lotes`, { params })),

  create: async (
    medId: number,
    payload: LoteFormData
  ): Promise<{ message: string; data: Lote }> =>
    data(api.post(`/medicamentos/${medId}/lotes`, payload)),

  update: async (
    loteId: number,
    payload: Partial<LoteFormData & { ativo?: boolean }>
  ): Promise<{ message: string; data: Lote }> =>
    data(api.put(`/lotes/${loteId}`, payload)),

  getByBarcode: async (
    codigo: string
  ): Promise<{ codigo_barras: string; lotes: Lote[]; total: number }> =>
    data(api.get(`/lotes/barcode/${codigo}`)),
};

// =============================================================================
// Estoque / Movimentações API
// =============================================================================
export const estoqueAPI = {
  // Entrada
  registrarEntrada: async (payload: {
    lote_id: number;
    quantidade: number;
    fornecedor_id?: number;
    nota_fiscal?: string;
    observacoes?: string;
  }): Promise<{ message: string; data: Movimentacao }> =>
    data(api.post("/estoque/entrada", payload)),

  // Dispensação FEFO
  dispensar: async (
    payload: DispensacaoFormData
  ): Promise<{ message: string; data: Movimentacao[] }> =>
    data(api.post("/estoque/dispensacao", payload)),

  // Dispensação lote específico
  dispensarLote: async (
    payload: DispensacaoLoteFormData
  ): Promise<{ message: string; data: Movimentacao }> =>
    data(api.post("/estoque/dispensacao/lote", payload)),

  // Ajuste
  registrarAjuste: async (payload: {
    lote_id: number;
    quantidade: number;
    positivo: boolean;
    observacoes?: string;
  }): Promise<{ message: string; data: Movimentacao }> =>
    data(api.post("/estoque/ajuste", payload)),

  // Descarte
  registrarDescarte: async (payload: {
    lote_id: number;
    quantidade: number;
    motivo: MotivoDescarte;
    observacoes?: string;
  }): Promise<{ message: string; data: Movimentacao }> =>
    data(api.post("/estoque/descarte", payload)),

  // Histórico
  getMovimentacoes: async (
    filters?: MovimentacaoFilters
  ): Promise<Movimentacao[]> => {
    const params: Record<string, unknown> = {};
    if (filters?.tipo) params.tipo = filters.tipo;
    if (filters?.medicamento_id) params.medicamento_id = filters.medicamento_id;
    if (filters?.lote_id) params.lote_id = filters.lote_id;
    if (filters?.cpf_paciente) params.cpf_paciente = filters.cpf_paciente;
    if (filters?.data_inicio) params.data_inicio = filters.data_inicio;
    if (filters?.data_fim) params.data_fim = filters.data_fim;
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.offset) params.offset = filters.offset;
    return data(api.get("/estoque/movimentacoes", { params }));
  },

  // Alertas
  getAlertas: async (tipo?: string): Promise<{ alertas: AlertaEstoque[]; total: number }> => {
    const params: Record<string, unknown> = {};
    if (tipo) params.tipo = tipo;
    return data(api.get("/estoque/alertas", { params }));
  },

  // Dashboard
  getDashboard: async (): Promise<DashboardEstoque> =>
    data(api.get("/estoque/dashboard")),

  // Vencimentos
  getVencimentos: async (cor?: string): Promise<VencimentosPorCor> =>
    data(api.get("/estoque/vencimentos", { params: cor ? { cor } : {} })),

  // Dispensações por paciente
  getDispensacoesPaciente: async (
    cpf: string,
    params?: { limit?: number; offset?: number }
  ): Promise<{ cpf_paciente: string; dispensacoes: Movimentacao[]; total: number }> =>
    data(api.get(`/estoque/dispensacoes/paciente/${cpf}`, { params })),
};

export default {
  fornecedores: fornecedoresAPI,
  medicamentos: medicamentosAPI,
  lotes: lotesAPI,
  estoque: estoqueAPI,
};