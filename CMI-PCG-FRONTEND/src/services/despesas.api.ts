// src/services/despesas.api.ts
import api from './api';
import type {
  Despesa,
  DespesaEnums,
  DespesaResumoMensal,
  DespesaAnalyticsSummary,
  DespesaDRE,
  DespesaUpcoming,
} from '@/types/despesas.types';

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export type TipoData = 'competencia' | 'vencimento' | 'pagamento' | 'criacao';

export type Situacao =
  | 'pagas'
  | 'pendentes'
  | 'atrasadas'
  | 'vencendo'
  | 'canceladas';

// ============================================
// CRUD Despesas
// ============================================
export const despesasAPI = {
  getAll: async (params?: {
    search?: string;
    mes?: number;
    ano?: number;
    tipo_data?: TipoData;
    situacao?: Situacao | '';
    categoria?: string;
    tipo_custo?: string;
    centro_custo?: string;
    status?: string;
    recorrencia?: string;
    forma_pagamento?: string;
    data_vencimento_inicio?: string;
    data_vencimento_fim?: string;
    data_competencia_inicio?: string;
    data_competencia_fim?: string;
    data_pagamento_inicio?: string;
    data_pagamento_fim?: string;
    data_criacao_inicio?: string;
    data_criacao_fim?: string;
    fornecedor_id?: number;
    empresa_id?: number;
    valor_min?: number;
    valor_max?: number;
    vencidas?: boolean;
    limit?: number;
    offset?: number;
    order?: string;
  }): Promise<Despesa[]> => data(api.get('/despesas', { params })),

  getById: async (id: number): Promise<Despesa> =>
    data(api.get(`/despesas/${id}`)),

  create: async (
    payload: Partial<Despesa>,
  ): Promise<{ message: string; despesa: Despesa }> => {
    const res = await api.post('/despesas', payload);
    return res.data;
  },

  update: async (
    id: number,
    payload: Partial<Despesa>,
  ): Promise<{ message: string; despesa: Despesa }> => {
    const res = await api.put(`/despesas/${id}`, payload);
    return res.data;
  },

  delete: async (id: number): Promise<{ message: string }> =>
    data(api.delete(`/despesas/${id}`)),

  marcarPaga: async (
    id: number,
    payload?: {
      data_pagamento?: string;
      valor_pago?: number;
      forma_pagamento?: string;
      conta_saida?: string;
      valor_juros_multa?: number;
      valor_desconto?: number;
    },
  ): Promise<{ message: string; despesa: Despesa }> => {
    const res = await api.patch(`/despesas/${id}/pagar`, payload || {});
    return res.data;
  },

  pagarLote: async (payload: {
    ids: number[];
    data_pagamento?: string;
    forma_pagamento?: string;
    conta_saida?: string;
  }): Promise<{
    message: string;
    resultados: { pagos: number[]; erros: { id: number; erro: string }[] };
  }> => {
    const res = await api.patch('/despesas/pagar-lote', payload);
    return res.data;
  },

  cancelar: async (
    id: number,
    motivo?: string,
  ): Promise<{ message: string; despesa: Despesa }> => {
    const res = await api.patch(`/despesas/${id}/cancelar`, { motivo });
    return res.data;
  },

  getResumo: async (
    mes: number,
    ano: number,
    tipo_data: TipoData = 'competencia',
  ): Promise<DespesaResumoMensal> =>
    data(api.get('/despesas/resumo', { params: { mes, ano, tipo_data } })),

  getEnums: async (): Promise<DespesaEnums> =>
    data(api.get('/despesas/enums')),
};

// ============================================
// Analytics Despesas
// ============================================
const ANALYTICS_PATH = '/despesas/analytics';

export const despesasAnalyticsAPI = {
  getSummary: async (params: {
    data_inicio: string;
    data_fim: string;
    comparar_periodo_anterior?: boolean;
  }): Promise<DespesaAnalyticsSummary> =>
    data(api.get(`${ANALYTICS_PATH}/summary`, { params })),

  getByCategory: async (params: {
    data_inicio: string;
    data_fim: string;
    agrupar_por?: 'categoria' | 'tipo_custo' | 'centro_custo' | 'forma_pagamento';
  }): Promise<{
    agrupado_por: string;
    total_geral: number;
    dados: {
      grupo: string;
      total: number;
      quantidade: number;
      percentual: number;
    }[];
  }> => data(api.get(`${ANALYTICS_PATH}/by-category`, { params })),

  getTrends: async (params?: { meses?: number }): Promise<{
    meses_analisados: number;
    tendencia_media_percentual: number;
    dados: {
      mes: string;
      mes_nome: string;
      total: number;
      quantidade: number;
      ticket_medio: number;
    }[];
  }> => data(api.get(`${ANALYTICS_PATH}/trends`, { params })),

  getTopSuppliers: async (params: {
    data_inicio: string;
    data_fim: string;
    limite?: number;
  }): Promise<{
    limite: number;
    dados: {
      posicao: number;
      fornecedor_nome: string;
      fornecedor_id: number | null;
      total: number;
      quantidade: number;
    }[];
  }> => data(api.get(`${ANALYTICS_PATH}/top-suppliers`, { params })),

  getDRE: async (params: {
    data_inicio: string;
    data_fim: string;
  }): Promise<DespesaDRE> =>
    data(api.get(`${ANALYTICS_PATH}/dre`, { params })),

  getUpcoming: async (params?: {
    dias?: number;
    incluir_atrasadas?: boolean;
  }): Promise<DespesaUpcoming> =>
    data(api.get(`${ANALYTICS_PATH}/upcoming`, { params })),
};

export default despesasAPI;