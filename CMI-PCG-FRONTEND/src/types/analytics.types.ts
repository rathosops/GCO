// src/types/analytics.types.ts

// ============================================
// Financial Analytics Types
// ============================================

// Resumo/Summary
export interface AnalyticsSummary {
  total_bruto: number;
  total_descontos: number;
  total_liquido: number;
  quantidade: number;
  ticket_medio: number;
  pacientes_unicos: number;
  empresas_unicas: number;
  convenios_unicos: number;
  periodo: {
    data_inicio: string;
    data_fim: string;
  };
  comparativo_anterior?: {
    total_bruto: number;
    total_liquido: number;
    quantidade: number;
    variacao_bruto_pct: number;
    variacao_liquido_pct: number;
    variacao_quantidade_pct: number;
  };
}

// Agregação por período
export interface AnalyticsByPeriod {
  periodo: string;
  label: string;
  total_bruto: number;
  total_descontos: number;
  total_liquido: number;
  quantidade: number;
  ticket_medio: number;
}

export type AgrupamentoPeriodo = 'dia' | 'semana' | 'mes' | 'ano';

// Agregação por categoria
export interface AnalyticsByCategory {
  categoria: string;
  total_bruto: number;
  total_descontos: number;
  total_liquido: number;
  quantidade: number;
  percentual: number;
}

export type CategoriaAgrupamento = 'origem' | 'tipo' | 'tipo_pessoa_pix' | 'conta_destinada_pix';

// Top entidades
export interface TopEntity {
  id: number | string;
  nome: string;
  total_bruto: number;
  total_liquido: number;
  quantidade: number;
  percentual: number;
}

export type EntidadeTipo = 'empresa' | 'convenio' | 'paciente';

// Busca avançada
export interface AdvancedSearchFilters {
  data_inicio?: string;
  data_fim?: string;
  origem?: string;
  tipo?: string;
  empresa_id?: number;
  convenio_id?: number;
  cpf?: string;
  nome_paciente?: string;
  valor_min?: number;
  valor_max?: number;
  valor_exato?: number;
  possui_desconto?: boolean;
  vinculado_nota_fiscal?: boolean;
  search?: string;
  numero_nota_fiscal?: string;
  limit?: number;
  offset?: number;
  order?: 'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc';
}

export interface AdvancedSearchResult {
  total: number;
  resumo: {
    total_bruto: number;
    total_descontos: number;
    total_liquido: number;
  };
  pagamentos: AdvancedSearchPayment[];
}

export interface AdvancedSearchPayment {
  id: number;
  data: string;
  tipo: string;
  origem: string;
  valor: number;
  valor_desconto: number;
  valor_liquido: number;
  nome_do_paciente?: string;
  cpf?: string;
  nome_empresa?: string;
  empresa_id?: number;
  nome_convenio?: string;
  convenio_id?: number;
  descricao?: string;
  vinculado_nota_fiscal?: boolean;
  numero_nota_fiscal?: string;
}

// Análise de dia específico
export interface DayDetailAnalysis {
  data: string;
  resumo: {
    total_bruto: number;
    total_descontos: number;
    total_liquido: number;
    quantidade: number;
  };
  agrupamentos: {
    por_tipo?: { categoria: string; total: number; quantidade: number }[];
    por_origem?: { categoria: string; total: number; quantidade: number }[];
    por_paciente?: { categoria: string; total: number; quantidade: number }[];
    por_empresa?: { categoria: string; total: number; quantidade: number }[];
    por_convenio?: { categoria: string; total: number; quantidade: number }[];
  };
  pagamentos: AdvancedSearchPayment[];
}

// Encontrar soma (subset sum)
export interface FindSumFilters {
  valor_alvo: number;
  tolerancia?: number;
  max_pagamentos?: number;
  data?: string;
  data_inicio?: string;
  data_fim?: string;
  cpf?: string;
  empresa_id?: number;
  convenio_id?: number;
}

export interface FindSumCombination {
  pagamentos: {
    id: number;
    data: string;
    valor: number;
    nome: string;
    tipo: string;
  }[];
  soma: number;
  diferenca: number;
  quantidade: number;
}

export interface FindSumResult {
  valor_alvo: number;
  tolerancia: number;
  combinacoes: FindSumCombination[];
  total_encontradas: number;
}

// Tendências
export interface TrendPoint {
  periodo: string;
  label: string;
  valor: number;
  variacao_pct?: number;
}

export interface TrendsResult {
  metrica: 'receita' | 'quantidade' | 'ticket_medio';
  meses: number;
  dados: TrendPoint[];
  tendencia_media_pct: number;
}

// Estatísticas de entidade específica
export interface EntityStats {
  entidade: {
    tipo: EntidadeTipo;
    id: number | string;
    nome: string;
  };
  periodo: {
    data_inicio: string;
    data_fim: string;
  };
  resumo: {
    total_bruto: number;
    total_descontos: number;
    total_liquido: number;
    quantidade: number;
    ticket_medio: number;
  };
  por_tipo: { tipo: string; total: number; quantidade: number }[];
  historico_mensal: {
    mes: string;
    label: string;
    total_bruto: number;
    total_liquido: number;
    quantidade: number;
  }[];
}

// Export de dados agregados
export interface ExportDataPoint {
  periodo: string;
  label: string;
  total_bruto: number;
  total_descontos: number;
  total_liquido: number;
  quantidade: number;
  ticket_medio: number;
  pacientes_unicos: number;
  empresas_unicas: number;
  convenios_unicos: number;
}

export interface ExportResult {
  periodo: {
    data_inicio: string;
    data_fim: string;
  };
  agrupamento: AgrupamentoPeriodo;
  dados: ExportDataPoint[];
}

// Params para API calls
export interface SummaryParams {
  data_inicio: string;
  data_fim: string;
  comparar_periodo_anterior?: boolean;
}

export interface ByPeriodParams {
  data_inicio: string;
  data_fim: string;
  agrupamento?: AgrupamentoPeriodo;
  origem?: string;
  tipo?: string;
}

export interface ByCategoryParams {
  data_inicio: string;
  data_fim: string;
  categoria: CategoriaAgrupamento;
}

export interface TopEntitiesParams {
  data_inicio: string;
  data_fim: string;
  entidade: EntidadeTipo;
  limite?: number;
}

export interface DayDetailParams {
  data: string;
  agrupar_por?: 'paciente' | 'empresa' | 'convenio' | 'tipo';
}

export interface TrendsParams {
  meses?: number;
  metrica?: 'receita' | 'quantidade' | 'ticket_medio';
}

export interface EntityStatsParams {
  data_inicio?: string;
  data_fim?: string;
}

export interface ExportParams {
  data_inicio: string;
  data_fim: string;
  agrupar?: AgrupamentoPeriodo;
}