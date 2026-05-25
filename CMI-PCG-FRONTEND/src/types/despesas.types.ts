// src/types/despesas.types.ts

export type DespesaCategoria =
  | 'PESSOAL'
  | 'ALUGUEL_INFRAESTRUTURA'
  | 'MATERIAIS_INSUMOS'
  | 'EQUIPAMENTOS'
  | 'SERVICOS_TERCEIRIZADOS'
  | 'UTILIDADES'
  | 'IMPOSTOS_TAXAS'
  | 'MARKETING'
  | 'MANUTENCAO'
  | 'SEGUROS'
  | 'EDUCACAO_TREINAMENTO'
  | 'ADMINISTRATIVO'
  | 'OUTROS';

export type DespesaTipoCusto = 'FIXO' | 'VARIAVEL';

export type DespesaCentroCusto =
  | 'ADMINISTRATIVO'
  | 'CLINICO'
  | 'LABORATORIO'
  | 'FARMACIA'
  | 'SERVICOS_TERCEIRIZADOS'
  | 'IMAGEM'
  | 'RECEPCAO'
  | 'LIMPEZA'
  | 'TI'
  | 'GERAL';

export type DespesaStatus = 'PENDENTE' | 'PAGA' | 'CANCELADA' | 'ATRASADA' | 'PARCIAL';

export type DespesaRecorrencia = 'UNICA' | 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

export type DespesaFormaPagamento =
  | 'PIX'
  | 'BOLETO'
  | 'DEBITO_AUTOMATICO'
  | 'TRANSFERENCIA'
  | 'CARTAO_CREDITO'
  | 'CARTAO_DEBITO'
  | 'DINHEIRO'
  | 'CHEQUE';

export type DespesaTipoDocumento =
  | 'NOTA_FISCAL'
  | 'BOLETO'
  | 'RECIBO'
  | 'FATURA'
  | 'GUIA'
  | 'OUTROS';

export interface Despesa {
  id?: number;
  descricao: string;
  observacoes?: string | null;
  categoria: DespesaCategoria;
  tipo_custo: DespesaTipoCusto;
  centro_custo?: DespesaCentroCusto | null;
  valor: number;
  valor_desconto?: number | null;
  valor_juros_multa?: number | null;
  valor_pago?: number | null;
  valor_liquido?: number;
  valor_efetivo?: number;
  data_competencia: string;
  data_vencimento: string;
  data_pagamento?: string | null;
  status: DespesaStatus;
  recorrencia: DespesaRecorrencia;
  despesa_pai_id?: number | null;
  forma_pagamento?: DespesaFormaPagamento | null;
  conta_saida?: string | null;
  fornecedor_id?: number | null;
  fornecedor_nome?: string | null;
  fornecedor_cnpj_cpf?: string | null;
  numero_documento?: string | null;
  tipo_documento?: DespesaTipoDocumento | null;
  empresa_id?: number | null;
  empresa_nome?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by_id?: number | null;
  updated_by_id?: number | null;
}

export interface DespesaEnums {
  categorias: string[];
  tipos_custo: string[];
  centros_custo: string[];
  status: string[];
  recorrencias: string[];
  formas_pagamento: string[];
  tipos_documento: string[];
}

export interface DespesaResumoMensal {
  mes: number;
  ano: number;
  total: number;
  total_pago: number;
  total_pendente: number;
  total_atrasado: number;
  por_categoria: { categoria: string; total: number; quantidade: number }[];
  por_tipo_custo: { tipo_custo: string; total: number }[];
  por_centro_custo: { centro_custo: string; total: number; quantidade: number }[];
  por_status: { status: string; total: number; quantidade: number }[];
}

// Analytics types
export interface DespesaAnalyticsSummary {
  periodo: { data_inicio: string; data_fim: string };
  kpis: {
    total: number;
    total_pago: number;
    total_pendente: number;
    total_atrasado: number;
    quantidade: number;
    ticket_medio: number;
  };
  comparativo?: {
    periodo_anterior: { data_inicio: string; data_fim: string; total: number } | null;
    variacao_percentual: number | null;
  } | null;
}

export interface DespesaDRE {
  periodo: { data_inicio: string; data_fim: string };
  receitas: { bruta: number; descontos: number; liquida: number };
  despesas: {
    total: number;
    fixa: number;
    variavel: number;
    por_categoria: { categoria: string; total: number; percentual: number }[];
  };
  resultado: { operacional: number; margem_operacional_pct: number };
}

export interface DespesaUpcoming {
  hoje: string;
  janela_dias: number;
  total_proximo: number;
  total_atrasado: number;
  total_geral: number;
  quantidade_proximas: number;
  quantidade_atrasadas: number;
  atrasadas: Despesa[];
  proximas: Despesa[];
}

// Labels para exibição
export const CATEGORIA_LABELS: Record<DespesaCategoria, string> = {
  PESSOAL: 'Pessoal / Folha',
  ALUGUEL_INFRAESTRUTURA: 'Aluguel / Infraestrutura',
  MATERIAIS_INSUMOS: 'Materiais e Insumos',
  EQUIPAMENTOS: 'Equipamentos',
  SERVICOS_TERCEIRIZADOS: 'Serviços Terceirizados',
  UTILIDADES: 'Utilidades (água, luz, etc)',
  IMPOSTOS_TAXAS: 'Impostos e Taxas',
  MARKETING: 'Marketing',
  MANUTENCAO: 'Manutenção',
  SEGUROS: 'Seguros',
  EDUCACAO_TREINAMENTO: 'Educação / Treinamento',
  ADMINISTRATIVO: 'Administrativo',
  OUTROS: 'Outros',
};

export const STATUS_LABELS: Record<DespesaStatus, string> = {
  PENDENTE: 'Pendente',
  PAGA: 'Paga',
  CANCELADA: 'Cancelada',
  ATRASADA: 'Atrasada',
  PARCIAL: 'Parcial',
};

export const CENTRO_CUSTO_LABELS: Record<DespesaCentroCusto, string> = {
  ADMINISTRATIVO: 'Administrativo',
  CLINICO: 'Clínico',
  LABORATORIO: 'Laboratório',
  FARMACIA: 'Farmácia',
  SERVICOS_TERCEIRIZADOS: 'Serviços Terceirizados',
  IMAGEM: 'Imagem',
  RECEPCAO: 'Recepção',
  LIMPEZA: 'Limpeza',
  TI: 'TI',
  GERAL: 'Geral',
};

export const FORMA_PAGAMENTO_LABELS: Record<DespesaFormaPagamento, string> = {
  PIX: 'PIX',
  BOLETO: 'Boleto',
  DEBITO_AUTOMATICO: 'Débito Automático',
  TRANSFERENCIA: 'Transferência',
  CARTAO_CREDITO: 'Cartão de Crédito',
  CARTAO_DEBITO: 'Cartão de Débito',
  DINHEIRO: 'Dinheiro',
  CHEQUE: 'Cheque',
};

export const RECORRENCIA_LABELS: Record<DespesaRecorrencia, string> = {
  UNICA: 'Única',
  MENSAL: 'Mensal',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
};