/**
 * API Service para Exames e Solicitações
 *
 * @module features/exames/api
 */

import api from '@/services/api';
import type {
  Exame,
  ExameFormData,
  ExameFilters,
  ExameStats,
  SolicitacaoExame,
  SolicitacaoFormData,
  SolicitacaoFilters,
  OrcamentoExames,
  ExameMaisSolicitado,
  SolicitacaoPorPeriodo,
  SolicitacaoPorStatus,
} from '../types';

const data = <T>(promise: Promise<{ data: T }>) => promise.then((r) => r.data);

// =============================================================================
// Exames CRUD
// =============================================================================
export const examesAPI = {
  list: async (filters?: ExameFilters): Promise<Exame[]> => {
    const params: Record<string, unknown> = {};
    if (filters?.search) params.search = filters.search;
    if (filters?.tipo) params.tipo = filters.tipo;
    if (filters?.ativo !== undefined && filters.ativo !== '') params.ativo = filters.ativo;
    if (filters?.valor_min) params.valor_min = filters.valor_min;
    if (filters?.valor_max) params.valor_max = filters.valor_max;
    if (filters?.order) params.order = filters.order;
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.offset) params.offset = filters.offset;
    return data(api.get('/exames', { params }));
  },

  getById: async (id: number): Promise<Exame> => data(api.get(`/exames/${id}`)),

  getByCodigo: async (codigo: string): Promise<Exame> => data(api.get(`/exames/codigo/${codigo}`)),

  create: async (payload: ExameFormData): Promise<{ message: string; data: Exame }> =>
    data(api.post('/exames', payload)),

  update: async (id: number, payload: Partial<ExameFormData>): Promise<{ message: string; data: Exame }> =>
    data(api.put(`/exames/${id}`, payload)),

  delete: async (id: number, hard = false): Promise<{ message: string }> => {
    const params = hard ? { hard: 'true' } : {};
    return data(api.delete(`/exames/${id}`, { params }));
  },

  getTipos: async (): Promise<string[]> => data(api.get('/exames/tipos')),

  getStats: async (): Promise<ExameStats> => data(api.get('/exames/stats')),

  calcular: async (
    examesIds: number[],
    desconto?: { percentual?: number; valor?: number }
  ): Promise<OrcamentoExames> =>
    data(
      api.post('/exames/calcular', {
        exames_ids: examesIds,
        desconto_percentual: desconto?.percentual,
        desconto_valor: desconto?.valor,
      })
    ),

  exportarCsv: async (filters?: ExameFilters): Promise<Blob> => {
    const params: Record<string, unknown> = {};
    if (filters?.search) params.search = filters.search;
    if (filters?.tipo) params.tipo = filters.tipo;
    if (filters?.ativo !== undefined) params.ativo = filters.ativo;
    const response = await api.get('/exames/exportar', { params, responseType: 'blob' });
    return response.data;
  },

  importarCsv: async (
    file: File
  ): Promise<{ message: string; criados: number; atualizados: number; erros: string[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    return data(
      api.post('/exames/importar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    );
  },
};

// =============================================================================
// Solicitações de Exames CRUD
// =============================================================================
export const solicitacoesExamesAPI = {
  list: async (filters?: SolicitacaoFilters): Promise<SolicitacaoExame[]> => {
    const params: Record<string, unknown> = {};
    if (filters?.search) params.search = filters.search;
    if (filters?.cpf_paciente) params.cpf_paciente = filters.cpf_paciente;
    if (filters?.status) params.status = filters.status;
    if (filters?.data_inicio) params.data_inicio = filters.data_inicio;
    if (filters?.data_fim) params.data_fim = filters.data_fim;
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.offset) params.offset = filters.offset;
    return data(api.get('/solicitacoes-exames', { params }));
  },

  getById: async (id: number): Promise<SolicitacaoExame> =>
    data(api.get(`/solicitacoes-exames/${id}`)),

  create: async (
    payload: SolicitacaoFormData
  ): Promise<{ message: string; data: SolicitacaoExame } | Blob> => {
    if (payload.gerar_pdf) {
      const response = await api.post('/solicitacoes-exames', payload, { responseType: 'blob' });
      return response.data;
    }
    return data(api.post('/solicitacoes-exames', payload));
  },

  update: async (
    id: number,
    payload: Partial<SolicitacaoFormData>
  ): Promise<{ message: string; data: SolicitacaoExame }> =>
    data(api.put(`/solicitacoes-exames/${id}`, payload)),

  delete: async (id: number): Promise<{ message: string }> =>
    data(api.delete(`/solicitacoes-exames/${id}`)),

  updateStatus: async (
    id: number,
    status: string
  ): Promise<{ message: string; data: SolicitacaoExame }> =>
    data(api.patch(`/solicitacoes-exames/${id}/status`, { status })),

  gerarPdf: async (
    pacienteId: number,
    examesIds: number[],
    salvar = false,
    status = 'PENDENTE',
    crmMedico?: number,
    semValores = false,
  ): Promise<Blob> => {
    const response = await api.post(
      '/gerar_solicitacao_exames',
      {
        paciente_id: pacienteId,
        exames_ids: examesIds,
        salvar_solicitacao_de_exame: salvar,
        status,
        crm_medico: crmMedico,
        sem_valores: semValores,
      },
      { responseType: 'blob' }
    );
    return response.data;
  },

  /**
   * Download PDF de uma solicitação existente.
   * @param id        ID da solicitação
   * @param semValores  true = PDF sem coluna de valores e total
   */
  downloadPdf: async (id: number, semValores = false): Promise<Blob> => {
    const params: Record<string, string> = {};
    if (semValores) params.sem_valores = 'true';
    const response = await api.get(`/solicitacoes-exames/${id}/pdf`, {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

// =============================================================================
// Relatórios
// =============================================================================
export const examesRelatoriosAPI = {
  maisSolicitados: async (params?: {
    data_inicio?: string;
    data_fim?: string;
    limite?: number;
  }): Promise<ExameMaisSolicitado[]> =>
    data(api.get('/relatorios/exames-mais-solicitados', { params })),

  porPeriodo: async (params: {
    data_inicio: string;
    data_fim: string;
    agrupar?: 'dia' | 'semana' | 'mes';
  }): Promise<SolicitacaoPorPeriodo[]> =>
    data(api.get('/relatorios/solicitacoes-por-periodo', { params })),

  porStatus: async (params?: {
    data_inicio?: string;
    data_fim?: string;
  }): Promise<SolicitacaoPorStatus[]> =>
    data(api.get('/relatorios/solicitacoes-por-status', { params })),
};