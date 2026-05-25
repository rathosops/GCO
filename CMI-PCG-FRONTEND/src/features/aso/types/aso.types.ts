// src/features/aso/types/aso.types.ts

// ============================================
// Enums & Literals
// ============================================

export type TipoExameASO =
  | 'Admissional'
  | 'Periódico'
  | 'Retorno ao Trabalho'
  | 'Mudança de Função'
  | 'Demissional';

export type ConclusaoASO =
  | 'APTO'
  | 'INAPTO'
  | 'APTO COM RESTRIÇÕES';

// ============================================
// Structured data
// ============================================

export interface RiscosOcupacionais {
  fisico: string;
  quimico: string;
  biologico: string;
  ergonomico: string;
  acidente: string;
}

export interface NormasRegulamentadoras {
  nr7: string;
  nr9: string;
  nr15: string;
  nr16: string;
  nr17: string;
  nr35: string;
}

// ============================================
// Form Data (input)
// ============================================

export interface AsoFormData {
  paciente: { nome: string; cpf: number | string } | null;
  empresa: { nome: string; cnpj: number | string } | null;
  medico: { nome: string; crm: number | string } | null;

  funcao_do_paciente: string;
  setor: string;
  tipo_de_exame: { exame: TipoExameASO | string };
  riscos: RiscosOcupacionais;
  exames_solicitados: { exames: string[] };
  conclusao: { status: ConclusaoASO | string };
  restricoes: string;
  nrs: NormasRegulamentadoras;
  manipulacao_de_alimentos: string;
  observacoes: string;
  salvar_aso: boolean;
}

// ============================================
// Record (backend response — after save)
// ============================================

export interface AsoRecord {
  id: number;
  cpf_paciente: number;
  cnpj_empresa: number;
  crm_medico: number;
  tipo_exame: string;
  funcao_paciente: string;
  setor: string | null;
  conclusao: string;
  restricoes: string | null;
  riscos_ocupacionais: Record<string, string>;
  exames_complementares: { exames?: string[] };
  normas_regulamentadoras: Record<string, string>;
  manipulacao_alimentos: string | null;
  observacoes: string | null;
  data: string;       // YYYY-MM-DD
  hora: string;       // HH:MM
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Included when include_relations=True
  paciente_nome?: string;
  empresa_nome?: string;
  medico_nome?: string;
  medico_especialidade?: string;
}

export interface AsoListResponse {
  total: number;
  limit: number;
  offset: number;
  asos: AsoRecord[];
}

export interface AsoHistoryResponse {
  paciente: {
    nome: string;
    cpf: number;
    cpf_formatado: string;
  };
  total: number;
  asos: AsoRecord[];
}

export interface AsoStatsResponse {
  total: number;
  pacientes_unicos: number;
  por_tipo_exame: Record<string, number>;
  por_conclusao: Record<string, number>;
  top_empresas: { nome: string; total: number }[];
}

// ============================================
// Filter params
// ============================================

export interface AsoFilterParams {
  cpf?: string;
  cnpj?: string;
  crm?: string;
  tipo_exame?: string;
  conclusao?: string;
  data_inicio?: string;
  data_fim?: string;
  search?: string;
  limit?: number;
  offset?: number;
  order?: 'data_desc' | 'data_asc';
}

// ============================================
// Constants
// ============================================

export const TIPOS_EXAME: TipoExameASO[] = [
  'Admissional',
  'Periódico',
  'Retorno ao Trabalho',
  'Mudança de Função',
  'Demissional',
];

export const TIPOS_EXAME_MAP: Record<string, string> = {
  ADMISSIONAL: 'Admissional',
  PERIODICO: 'Periódico',
  RETORNO_AO_TRABALHO: 'Retorno ao Trabalho',
  MUDANCA_DE_FUNCAO: 'Mudança de Função',
  DEMISSIONAL: 'Demissional',
};

export const CONCLUSOES: ConclusaoASO[] = [
  'APTO',
  'INAPTO',
  'APTO COM RESTRIÇÕES',
];

export const CONCLUSAO_MAP: Record<string, string> = {
  APTO: 'Apto',
  INAPTO: 'Inapto',
  APTO_COM_RESTRICOES: 'Apto com Restrições',
};

export const NR_OPTIONS = ['Conforme', 'Não conforme', 'Não se aplica', ''];

export const RISCOS_KEYS: (keyof RiscosOcupacionais)[] = [
  'fisico', 'quimico', 'biologico', 'ergonomico', 'acidente',
];

export const RISCOS_LABELS: Record<keyof RiscosOcupacionais, string> = {
  fisico: 'Físico',
  quimico: 'Químico',
  biologico: 'Biológico',
  ergonomico: 'Ergonômico',
  acidente: 'Acidente',
};

export const NRS_KEYS: (keyof NormasRegulamentadoras)[] = [
  'nr7', 'nr9', 'nr15', 'nr16', 'nr17', 'nr35',
];

export const NRS_LABELS: Record<keyof NormasRegulamentadoras, string> = {
  nr7: 'NR-7 (PCMSO)',
  nr9: 'NR-9 (PGR)',
  nr15: 'NR-15 (Insalubridade)',
  nr16: 'NR-16 (Periculosidade)',
  nr17: 'NR-17 (Ergonomia)',
  nr35: 'NR-35 (Trabalho em Altura)',
};

export const EMPTY_FORM: AsoFormData = {
  paciente: null,
  empresa: null,
  medico: null,
  funcao_do_paciente: '',
  setor: '',
  tipo_de_exame: { exame: '' },
  riscos: { fisico: '', quimico: '', biologico: '', ergonomico: '', acidente: '' },
  exames_solicitados: { exames: [] },
  conclusao: { status: '' },
  restricoes: '',
  nrs: { nr7: '', nr9: '', nr15: '', nr16: '', nr17: '', nr35: '' },
  manipulacao_de_alimentos: '',
  observacoes: '',
  salvar_aso: true,
};