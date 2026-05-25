/**
 * API de Feriados e Comprovante de Agendamento
 */
import { api } from '@/services/api';

// ============================================
// Types
// ============================================

export interface FeriadoInfo {
  data: string; // YYYY-MM-DD
  nome: string;
  tipo: 'NACIONAL' | 'ESTADUAL' | 'MUNICIPAL' | 'PONTO_FACULTATIVO' | 'CLINICA';
  bloqueia_agendamento: boolean;
  oficial: boolean;
  recorrente?: boolean;
}

export interface VerificarDataResponse {
  data: string;
  disponivel: boolean;
  motivo: string | null;
  is_feriado?: boolean;
  is_fim_de_semana?: boolean;
  feriado_nome?: string;
}

export interface FeriadoCustomizado {
  id: number;
  data: string;
  nome: string;
  tipo: string;
  bloqueia_agendamento: boolean;
  recorrente: boolean;
  observacoes?: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FeriadosMesResponse {
  ano: number;
  mes: number;
  feriados: FeriadoInfo[];
}

export interface DiasUteisResponse {
  data_inicio: string;
  data_fim: string;
  dias_uteis: number;
  dias_totais: number;
}

// ============================================
// Feriados API
// ============================================

export const feriadosAPI = {
  /**
   * Verifica se uma data está disponível para agendamento
   */
  verificarData: async (data: string): Promise<VerificarDataResponse> => {
    const res = await api.get<VerificarDataResponse>('/agendamentos/verificar-data', {
      params: { data },
    });
    return res.data;
  },

  /**
   * Lista feriados em um período
   */
  listar: async (dataInicio: string, dataFim: string): Promise<FeriadoInfo[]> => {
    const res = await api.get<{ feriados: FeriadoInfo[] }>('/feriados', {
      params: { data_inicio: dataInicio, data_fim: dataFim },
    });
    return res.data.feriados;
  },

  /**
   * Lista feriados de um mês específico
   */
  listarMes: async (ano: number, mes: number): Promise<FeriadosMesResponse> => {
    const res = await api.get<FeriadosMesResponse>('/feriados/mes', {
      params: { ano, mes },
    });
    return res.data;
  },

  /**
   * Conta dias úteis entre duas datas
   */
  contarDiasUteis: async (dataInicio: string, dataFim: string): Promise<DiasUteisResponse> => {
    const res = await api.get<DiasUteisResponse>('/feriados/dias-uteis', {
      params: { data_inicio: dataInicio, data_fim: dataFim },
    });
    return res.data;
  },

  /**
   * Retorna o próximo dia útil a partir de uma data
   */
  proximoDiaUtil: async (data: string): Promise<{ data: string; proximo_dia_util: string }> => {
    const res = await api.get<{ data: string; proximo_dia_util: string }>('/feriados/proximo-dia-util', {
      params: { data },
    });
    return res.data;
  },

  // ---- CRUD Feriados Customizados ----

  /**
   * Lista feriados customizados
   */
  listarCustomizados: async (params?: {
    ano?: number;
    ativo?: boolean;
    tipo?: string;
  }): Promise<FeriadoCustomizado[]> => {
    const res = await api.get<{ feriados: FeriadoCustomizado[] }>('/feriados/customizados', { params });
    return res.data.feriados;
  },

  /**
   * Cria feriado customizado
   */
  criarCustomizado: async (payload: {
    data: string;
    nome: string;
    tipo?: string;
    bloqueia_agendamento?: boolean;
    recorrente?: boolean;
    observacoes?: string;
  }): Promise<FeriadoCustomizado> => {
    const res = await api.post<{ feriado: FeriadoCustomizado }>('/feriados/customizados', payload);
    return res.data.feriado;
  },

  /**
   * Atualiza feriado customizado
   */
  atualizarCustomizado: async (
    id: number,
    payload: Partial<{
      data: string;
      nome: string;
      tipo: string;
      bloqueia_agendamento: boolean;
      recorrente: boolean;
      observacoes: string;
    }>
  ): Promise<FeriadoCustomizado> => {
    const res = await api.put<{ feriado: FeriadoCustomizado }>(`/feriados/customizados/${id}`, payload);
    return res.data.feriado;
  },

  /**
   * Remove feriado customizado (soft delete por padrão)
   */
  removerCustomizado: async (id: number, hard = false): Promise<void> => {
    await api.delete(`/feriados/customizados/${id}`, { params: { hard } });
  },
};

// ============================================
// Comprovante de Agendamento API
// ============================================

export const comprovanteAPI = {
  /**
   * Baixa o comprovante de agendamento em PDF
   */
  downloadPdf: async (agendamentoId: number): Promise<Blob> => {
    const res = await api.get(`/agendamentos/${agendamentoId}/comprovante/pdf`, {
      params: { download: true },
      responseType: 'blob',
    });
    return res.data;
  },

  /**
   * Visualiza o comprovante inline (abre em nova aba)
   */
  visualizarPdf: async (agendamentoId: number): Promise<Blob> => {
    const res = await api.get(`/agendamentos/${agendamentoId}/comprovante/pdf`, {
      params: { download: false },
      responseType: 'blob',
    });
    return res.data;
  },

  /**
   * Retorna dados do comprovante (JSON) para preview
   */
  getDados: async (agendamentoId: number): Promise<any> => {
    const res = await api.get(`/agendamentos/${agendamentoId}/comprovante`);
    return res.data;
  },
};

export default feriadosAPI;
