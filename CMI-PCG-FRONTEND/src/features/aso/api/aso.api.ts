// src/features/aso/api/aso.api.ts

import api from '@/services/api';
import type {
  AsoFormData,
  AsoRecord,
  AsoListResponse,
  AsoHistoryResponse,
  AsoStatsResponse,
  AsoFilterParams,
} from '../types/aso.types';
import { onlyDigits } from '@/utils/formatters';

// ============================================
// Payload builder
// ============================================

function buildPayload(form: AsoFormData) {
  return {
    paciente: {
      nome: form.paciente!.nome,
      cpf: Number(onlyDigits(String(form.paciente!.cpf))),
    },
    empresa: {
      nome: form.empresa!.nome,
      cnpj: Number(onlyDigits(String(form.empresa!.cnpj))),
    },
    medico: {
      nome: form.medico!.nome,
      crm: Number(onlyDigits(String(form.medico!.crm))),
    },
    funcao_do_paciente: form.funcao_do_paciente,
    setor: form.setor || undefined,
    tipo_de_exame: form.tipo_de_exame,
    riscos: form.riscos,
    exames_solicitados: form.exames_solicitados.exames.length
      ? form.exames_solicitados
      : undefined,
    conclusao: form.conclusao,
    restricoes: form.restricoes || undefined,
    nrs: form.nrs,
    manipulacao_de_alimentos: form.manipulacao_de_alimentos || undefined,
    observacoes: form.observacoes || undefined,
    salvar_aso: form.salvar_aso,
  };
}

// ============================================
// API
// ============================================

export const asoAPI = {
  // --- CRUD ---

  /** Cria ASO (retorna JSON com record) */
  criar: async (form: AsoFormData): Promise<{ message: string; aso: AsoRecord }> => {
    const payload = buildPayload(form);
    const { data } = await api.post('/asos', payload);
    return data;
  },

  /** Cria ASO + retorna PDF */
  criarComPdf: async (form: AsoFormData): Promise<Blob> => {
    const payload = buildPayload(form);
    const { data } = await api.post('/asos?gerar_pdf=true', payload, {
      responseType: 'blob',
      timeout: 30000,
    });
    return data;
  },

  /** Lista ASOs com filtros e paginação */
  listar: async (params: AsoFilterParams = {}): Promise<AsoListResponse> => {
    const { data } = await api.get('/asos', { params });
    return data;
  },

  /** Detalhe de um ASO */
  detalhe: async (id: number): Promise<AsoRecord> => {
    const { data } = await api.get(`/asos/${id}`);
    return data;
  },

  /** Atualiza ASO */
  atualizar: async (id: number, payload: Partial<AsoFormData>): Promise<{ message: string; aso: AsoRecord }> => {
    const { data } = await api.put(`/asos/${id}`, payload);
    return data;
  },

  /** Exclui ASO */
  excluir: async (id: number): Promise<{ message: string }> => {
    const { data } = await api.delete(`/asos/${id}`);
    return data;
  },

  // --- Histórico & Stats ---

  /** Histórico de ASOs de um paciente */
  historico: async (cpf: string): Promise<AsoHistoryResponse> => {
    const { data } = await api.get(`/asos/historico/${onlyDigits(cpf)}`);
    return data;
  },

  /** Estatísticas gerais */
  stats: async (params?: {
    cnpj?: string;
    data_inicio?: string;
    data_fim?: string;
  }): Promise<AsoStatsResponse> => {
    const { data } = await api.get('/asos/stats', { params });
    return data;
  },

  // --- PDF ---

  /** Preview PDF sem salvar */
  gerarPdfPreview: async (form: AsoFormData): Promise<Blob> => {
    const payload = buildPayload(form);
    const { data } = await api.post('/asos/gerar-pdf', payload, {
      responseType: 'blob',
      timeout: 30000,
    });
    return data;
  },

  /** Regera PDF de ASO salvo */
  gerarPdfSalvo: async (id: number): Promise<Blob> => {
    const { data } = await api.get(`/asos/${id}/pdf`, {
      responseType: 'blob',
      timeout: 30000,
    });
    return data;
  },

  // --- Legado (compatibilidade) ---

  /** Endpoint legado /gerar_aso */
  gerarPdf: async (form: AsoFormData): Promise<Blob> => {
    const payload = buildPayload(form);
    const { data } = await api.post('/gerar_aso', payload, {
      responseType: 'blob',
      timeout: 30000,
    });
    return data;
  },
};

// ============================================
// Helpers
// ============================================

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function extractBlobError(error: any): Promise<string> {
  if (error.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text();
      const json = JSON.parse(text);
      return json.error || 'Erro ao processar ASO.';
    } catch {
      return 'Erro ao processar ASO.';
    }
  }
  return error.response?.data?.error || 'Erro ao processar ASO.';
}

export default asoAPI;