/**
 * Types para o módulo de Exames
 *
 * @module features/exames/types
 */

/** Converte valor seguro p/ number (Numeric/Decimal do backend pode vir como string) */
export const n = (v: unknown): number => Number(v) || 0;

// =============================================================================
// Exame
// =============================================================================
export interface Exame {
  id: number;
  codigo: string | null;
  codigo_parceiro: string | null;
  nome: string;
  tipo: string;
  valor_cmi: number;
  valor_venda: number;
  valor_parceiro: number;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
  created_by_id?: number | null;
  updated_by_id?: number | null;
  margem?: number;
  margem_percentual?: number;
}

export interface ExameFormData {
  nome: string;
  tipo: string;
  codigo?: string;
  codigo_parceiro?: string;
  valor_cmi?: number;
  valor_venda?: number;
  valor_parceiro?: number;
  ativo?: boolean;
}

export interface ExameFilters {
  search?: string;
  tipo?: string;
  ativo?: boolean | string;
  valor_min?: number;
  valor_max?: number;
  order?: ExameOrder;
  limit?: number;
  offset?: number;
}

export type ExameOrder =
  | 'nome_asc'
  | 'nome_desc'
  | 'valor_asc'
  | 'valor_desc'
  | 'codigo_asc'
  | 'codigo_desc'
  | 'tipo_asc'
  | 'created_desc';

/** Categorias de exames para abas */
export type ExameCategoria = 'TODOS' | 'LABORATORIAL' | 'IMAGEM' | 'CLINICO' | 'OUTROS';

export const EXAME_CATEGORIAS: { value: ExameCategoria; label: string; icon?: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'LABORATORIAL', label: 'Laboratoriais' },
  { value: 'IMAGEM', label: 'Imagem' },
  { value: 'CLINICO', label: 'Clínicos' },
  { value: 'OUTROS', label: 'Outros' },
];

// =============================================================================
// Solicitação de Exames
// =============================================================================
export type SolicitacaoStatus = 'PENDENTE' | 'FATURADO' | 'EXTERNO' | 'CANCELADO';

export interface SolicitacaoExame {
  id: number;
  cpf_paciente: string;
  nome_paciente: string;
  data: string;
  hora: string;
  exames: string;
  exames_ids: string | null;
  soma_dos_valores: number;
  valor_desconto: number;
  valor_final: number;
  status: SolicitacaoStatus;
  observacoes: string | null;
  crm_medico: number | null;
  nome_medico: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SolicitacaoFormData {
  paciente_id?: number;
  cpf_paciente?: string;
  exames_ids: number[];
  status?: SolicitacaoStatus;
  observacoes?: string;
  crm_medico?: number;
  desconto_percentual?: number;
  desconto_valor?: number;
  gerar_pdf?: boolean;
}

export interface SolicitacaoFilters {
  search?: string;
  cpf_paciente?: string;
  status?: SolicitacaoStatus | '';
  data_inicio?: string;
  data_fim?: string;
  limit?: number;
  offset?: number;
}

// =============================================================================
// Cálculo de Orçamento
// =============================================================================
export interface OrcamentoExames {
  quantidade: number;
  exames: Exame[];
  total_cmi: number;
  total_venda: number;
  total_parceiro: number;
  desconto: number;
  total_final: number;
  margem_bruta: number;
}

// =============================================================================
// Estatísticas
// =============================================================================
export interface ExameStats {
  total: number;
  ativos: number;
  inativos: number;
  sem_codigo: number;
  por_tipo: { tipo: string; total: number }[];
  media_valor_cmi: number;
  media_valor_venda: number;
  media_valor_parceiro: number;
}

// =============================================================================
// Relatórios
// =============================================================================
export interface ExameMaisSolicitado {
  nome: string;
  total: number;
  posicao: number;
}

export interface SolicitacaoPorPeriodo {
  periodo: string;
  total_solicitacoes: number;
  valor_total: number;
}

export interface SolicitacaoPorStatus {
  status: SolicitacaoStatus;
  total: number;
  valor_total: number;
}