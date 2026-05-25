// src/services/analytics.api.ts
/**
 * API Service para Analytics Financeiro
 * 
 * Este arquivo faz a transformação entre as respostas do backend
 * e os tipos esperados pelo frontend.
 */
import api from './api';
import type {
  AnalyticsSummary,
  AnalyticsByPeriod,
  AnalyticsByCategory,
  TopEntity,
  AdvancedSearchFilters,
  AdvancedSearchResult,
  DayDetailAnalysis,
  FindSumFilters,
  FindSumResult,
  TrendsResult,
  TrendPoint,
  EntityStats,
  ExportResult,
  SummaryParams,
  ByPeriodParams,
  ByCategoryParams,
  TopEntitiesParams,
  DayDetailParams,
  TrendsParams,
  EntityStatsParams,
  ExportParams,
  EntidadeTipo,
} from '@/types/analytics.types';

const BASE_PATH = '/financeiro/analytics';

// ============================================
// Helper: Safe number extraction
// ============================================
function safeNum(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// ============================================
// Transformers: Backend -> Frontend
// ============================================

/**
 * Transforma resposta do /summary para AnalyticsSummary
 * 
 * Backend retorna:
 * {
 *   periodo: { data_inicio, data_fim, dias },
 *   kpis: { total_bruto, total_descontos, total_liquido, quantidade_pagamentos, ... },
 *   comparativo: { periodo_anterior, variacao_percentual }
 * }
 */
function transformSummary(response: any): AnalyticsSummary {
  const kpis = response?.kpis || {};
  const periodo = response?.periodo || {};
  const comparativo = response?.comparativo || {};
  const periodoAnterior = comparativo?.periodo_anterior || {};

  // Calcular variações se houver comparativo
  let comparativoAnterior: AnalyticsSummary['comparativo_anterior'] | undefined;
  
  if (comparativo && periodoAnterior?.total_liquido !== undefined) {
    const prevLiquido = safeNum(periodoAnterior.total_liquido);
    const currLiquido = safeNum(kpis.total_liquido);
    const currBruto = safeNum(kpis.total_bruto);
    const currQtd = safeNum(kpis.quantidade_pagamentos);

    comparativoAnterior = {
      total_bruto: prevLiquido, // Backend não retorna bruto anterior, usamos líquido
      total_liquido: prevLiquido,
      quantidade: 0, // Backend não retorna quantidade anterior
      variacao_bruto_pct: safeNum(comparativo.variacao_percentual),
      variacao_liquido_pct: safeNum(comparativo.variacao_percentual),
      variacao_quantidade_pct: 0,
    };
  }

  return {
    total_bruto: safeNum(kpis.total_bruto),
    total_descontos: safeNum(kpis.total_descontos),
    total_liquido: safeNum(kpis.total_liquido),
    quantidade: safeNum(kpis.quantidade_pagamentos),
    ticket_medio: safeNum(kpis.ticket_medio),
    pacientes_unicos: safeNum(kpis.pacientes_unicos),
    empresas_unicas: safeNum(kpis.empresas_unicas),
    convenios_unicos: safeNum(kpis.convenios_unicos),
    periodo: {
      data_inicio: periodo.data_inicio || '',
      data_fim: periodo.data_fim || '',
    },
    comparativo_anterior: comparativoAnterior,
  };
}

/**
 * Transforma resposta do /by-period para AnalyticsByPeriod[]
 * 
 * Backend retorna:
 * {
 *   agrupamento: "dia",
 *   total_registros: 10,
 *   dados: [{ periodo, total_bruto, total_descontos, total_liquido, quantidade }]
 * }
 */
function transformByPeriod(response: any): AnalyticsByPeriod[] {
  const dados = response?.dados;
  if (!Array.isArray(dados)) return [];

  return dados.map((item: any) => {
    const bruto = safeNum(item?.total_bruto);
    const descontos = safeNum(item?.total_descontos);
    const liquido = safeNum(item?.total_liquido) || (bruto - descontos);
    const quantidade = safeNum(item?.quantidade);

    return {
      periodo: item?.periodo || '',
      label: formatPeriodLabel(item?.periodo),
      total_bruto: bruto,
      total_descontos: descontos,
      total_liquido: liquido,
      quantidade,
      ticket_medio: quantidade > 0 ? liquido / quantidade : 0,
    };
  });
}

/**
 * Formata label do período para exibição
 */
function formatPeriodLabel(periodo: string | null | undefined): string {
  if (!periodo) return '';
  
  // Se for data completa (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(periodo)) {
    const date = new Date(periodo + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }
  
  // Se for mês (YYYY-MM)
  if (/^\d{4}-\d{2}$/.test(periodo)) {
    const [year, month] = periodo.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  }
  
  return periodo;
}

/**
 * Transforma resposta do /by-category para AnalyticsByCategory[]
 * 
 * Backend retorna:
 * {
 *   tipo_categoria: "origem",
 *   total_geral: 10000,
 *   dados: [{ categoria, total_bruto, total_descontos, total_liquido, quantidade, percentual }]
 * }
 */
function transformByCategory(response: any): AnalyticsByCategory[] {
  const dados = response?.dados;
  if (!Array.isArray(dados)) return [];

  return dados.map((item: any) => ({
    categoria: item?.categoria || 'N/A',
    total_bruto: safeNum(item?.total_bruto),
    total_descontos: safeNum(item?.total_descontos),
    total_liquido: safeNum(item?.total_liquido),
    quantidade: safeNum(item?.quantidade),
    percentual: safeNum(item?.percentual),
  }));
}

/**
 * Transforma resposta do /top-entities para TopEntity[]
 * 
 * Backend retorna:
 * {
 *   entidade: "empresa",
 *   limite: 10,
 *   dados: [{ posicao, id, nome, total_bruto, total_descontos, total_liquido, quantidade_pagamentos }]
 * }
 */
function transformTopEntities(response: any): TopEntity[] {
  const dados = response?.dados;
  if (!Array.isArray(dados)) return [];

  // Calcular total para percentuais
  const totalGeral = dados.reduce((acc: number, item: any) => 
    acc + safeNum(item?.total_liquido), 0
  );

  return dados.map((item: any) => {
    const liquido = safeNum(item?.total_liquido);
    return {
      id: item?.id || 0,
      nome: item?.nome || 'N/A',
      total_bruto: safeNum(item?.total_bruto),
      total_liquido: liquido,
      quantidade: safeNum(item?.quantidade_pagamentos || item?.quantidade),
      percentual: totalGeral > 0 ? (liquido / totalGeral) * 100 : 0,
    };
  });
}

/**
 * Transforma resposta do /trends para TrendsResult
 * 
 * Backend retorna:
 * {
 *   metrica: "receita",
 *   meses_analisados: 6,
 *   tendencia_media_percentual: 5.2,
 *   dados: [{ mes, mes_nome, valor, receita_liquida, quantidade, ticket_medio }]
 * }
 */
function transformTrends(response: any): TrendsResult {
  const dados = response?.dados;
  const pontos: TrendPoint[] = [];

  if (Array.isArray(dados)) {
    for (let i = 0; i < dados.length; i++) {
      const item = dados[i];
      const valor = safeNum(item?.valor);
      
      // Calcular variação em relação ao mês anterior
      let variacao_pct: number | undefined;
      if (i > 0) {
        const valorAnterior = safeNum(dados[i - 1]?.valor);
        if (valorAnterior > 0) {
          variacao_pct = ((valor - valorAnterior) / valorAnterior) * 100;
        }
      }

      pontos.push({
        periodo: item?.mes || '',
        label: item?.mes_nome || formatPeriodLabel(item?.mes),
        valor,
        variacao_pct,
      });
    }
  }

  return {
    metrica: response?.metrica || 'receita',
    meses: safeNum(response?.meses_analisados),
    dados: pontos,
    tendencia_media_pct: safeNum(response?.tendencia_media_percentual),
  };
}

/**
 * Transforma resposta do /find-sum para FindSumResult
 */
function transformFindSum(response: any): FindSumResult {
  const combinacoes = response?.combinacoes;
  
  return {
    valor_alvo: safeNum(response?.valor_alvo),
    tolerancia: safeNum(response?.tolerancia),
    total_encontradas: safeNum(response?.combinacoes_encontradas),
    combinacoes: Array.isArray(combinacoes) 
      ? combinacoes.map((combo: any) => ({
          pagamentos: Array.isArray(combo?.pagamentos) 
            ? combo.pagamentos.map((p: any) => ({
                id: p?.id || 0,
                data: p?.data || '',
                valor: safeNum(p?.valor),
                nome: p?.nome || 'N/A',
                tipo: p?.tipo || 'N/A',
              }))
            : [],
          soma: safeNum(combo?.soma),
          diferenca: safeNum(combo?.diferenca),
          quantidade: safeNum(combo?.quantidade_pagamentos || combo?.pagamentos?.length),
        }))
      : [],
  };
}

/**
 * Transforma resposta do /search para AdvancedSearchResult
 */
function transformSearch(response: any): AdvancedSearchResult {
  const resumo = response?.resumo || {};
  const pagamentos = response?.pagamentos;

  return {
    total: safeNum(response?.total),
    resumo: {
      total_bruto: safeNum(resumo.total_bruto),
      total_descontos: safeNum(resumo.total_descontos),
      total_liquido: safeNum(resumo.total_liquido),
    },
    pagamentos: Array.isArray(pagamentos) 
      ? pagamentos.map((p: any) => ({
          id: p?.id || 0,
          data: p?.data || '',
          tipo: p?.tipo || '',
          origem: p?.origem || '',
          valor: safeNum(p?.valor),
          valor_desconto: safeNum(p?.valor_desconto),
          valor_liquido: safeNum(p?.valor_liquido),
          nome_do_paciente: p?.nome_do_paciente,
          cpf: p?.cpf,
          nome_empresa: p?.nome_empresa,
          empresa_id: p?.empresa_id,
          nome_convenio: p?.nome_convenio,
          convenio_id: p?.convenio_id,
          descricao: p?.descricao,
          vinculado_nota_fiscal: p?.vinculado_nota_fiscal,
          numero_nota_fiscal: p?.numero_nota_fiscal,
        }))
      : [],
  };
}

// ============================================
// API Methods
// ============================================

export const analyticsAPI = {
  /**
   * Resumo com KPIs principais
   * GET /financeiro/analytics/summary
   */
  getSummary: async (params: SummaryParams): Promise<AnalyticsSummary> => {
    const response = await api.get(`${BASE_PATH}/summary`, { params });
    return transformSummary(response.data);
  },

  /**
   * Agregação por período (dia/semana/mês/ano)
   * GET /financeiro/analytics/by-period
   */
  getByPeriod: async (params: ByPeriodParams): Promise<AnalyticsByPeriod[]> => {
    const response = await api.get(`${BASE_PATH}/by-period`, { params });
    return transformByPeriod(response.data);
  },

  /**
   * Agregação por categoria (origem/tipo/tipo_pessoa_pix/conta_destinada_pix)
   * GET /financeiro/analytics/by-category
   */
  getByCategory: async (params: ByCategoryParams): Promise<AnalyticsByCategory[]> => {
    const response = await api.get(`${BASE_PATH}/by-category`, { params });
    return transformByCategory(response.data);
  },

  /**
   * Ranking de entidades (empresa/convênio/paciente)
   * GET /financeiro/analytics/top-entities
   */
  getTopEntities: async (params: TopEntitiesParams): Promise<TopEntity[]> => {
    const response = await api.get(`${BASE_PATH}/top-entities`, { params });
    return transformTopEntities(response.data);
  },

  /**
   * Busca avançada com múltiplos filtros
   * GET /financeiro/analytics/search
   */
  search: async (filters: AdvancedSearchFilters): Promise<AdvancedSearchResult> => {
    const response = await api.get(`${BASE_PATH}/search`, { params: filters });
    return transformSearch(response.data);
  },

  /**
   * Análise detalhada de um dia específico
   * GET /financeiro/analytics/by-day-detail
   */
  getDayDetail: async (params: DayDetailParams): Promise<DayDetailAnalysis> => {
    const response = await api.get(`${BASE_PATH}/by-day-detail`, { params });
    // A estrutura já é compatível, mas garantimos tipagem
    return response.data as DayDetailAnalysis;
  },

  /**
   * Encontrar combinações de pagamentos que somam um valor alvo
   * GET /financeiro/analytics/find-sum
   */
  findSum: async (params: FindSumFilters): Promise<FindSumResult> => {
    const response = await api.get(`${BASE_PATH}/find-sum`, { params });
    return transformFindSum(response.data);
  },

  /**
   * Análise de tendências mensais
   * GET /financeiro/analytics/trends
   */
  getTrends: async (params?: TrendsParams): Promise<TrendsResult> => {
    const response = await api.get(`${BASE_PATH}/trends`, { params });
    return transformTrends(response.data);
  },

  /**
   * Estatísticas detalhadas de uma entidade específica
   * GET /financeiro/analytics/entity-stats/:entidade/:entity_id
   */
  getEntityStats: async (
    entidade: EntidadeTipo,
    entityId: number | string,
    params?: EntityStatsParams
  ): Promise<EntityStats> => {
    const response = await api.get(`${BASE_PATH}/entity-stats/${entidade}/${entityId}`, { params });
    // A estrutura já é compatível
    return response.data as EntityStats;
  },

  /**
   * Exportar dados agregados
   * GET /financeiro/analytics/export
   */
  exportData: async (params: ExportParams): Promise<ExportResult> => {
    const response = await api.get(`${BASE_PATH}/export`, { params });
    // A estrutura já é compatível
    return response.data as ExportResult;
  },
};

export default analyticsAPI;