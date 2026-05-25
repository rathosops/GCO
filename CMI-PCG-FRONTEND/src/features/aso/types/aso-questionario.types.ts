// src/features/aso/types/aso-questionario.types.ts

// ============================================
// Anamnese structure (mirrors backend template)
// ============================================

export interface AnamnesePergunta {
  texto: string;
  resposta: 'sim' | 'nao' | null;
  observacao: string;
}

export interface AnamneseGrupos {
  condicoes_gerais: AnamnesePergunta[];
  antecedentes: AnamnesePergunta[];
  historico_ocupacional: AnamnesePergunta[];
  habitos: AnamnesePergunta[];
  perguntas_femininas: AnamnesePergunta[];
  antecedentes_familiares: AnamnesePergunta[];
}

export type AnamneseGrupoKey = keyof AnamneseGrupos;

export interface ExameClinico {
  pa?: string;
  fc?: string;
  peso?: string;
  altura?: string;
  imc?: string;
  temperatura?: string;
  av_od_sc?: string;
  av_od_cc?: string;
  av_oe_sc?: string;
  av_oe_cc?: string;
  impressao?: string;
}

// ============================================
// Questionario record (backend response)
// ============================================

export type QuestionarioStatus = 'pendente' | 'vinculado' | 'completo';
export type QuestionarioOrigem = 'google_forms' | 'manual';

export interface AsoQuestionario {
  id: number;
  aso_id: number | null;
  cpf_paciente: string | null;
  nome_paciente: string | null;
  status: QuestionarioStatus;
  origem: QuestionarioOrigem;
  anamnese: AnamneseGrupos;
  exame_clinico: ExameClinico;
  observacoes_medicas: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// ============================================
// API responses
// ============================================

export interface QuestionarioGetResponse {
  // Quando não existe questionário vinculado
  message?: string;
  data?: null;
  has_pending?: boolean;
}

export interface FormLinkResponse {
  url: string;
  paciente_nome: string | null;
  cpf: string | null;
}

// ============================================
// Display constants
// ============================================

export const GRUPO_LABELS: Record<AnamneseGrupoKey, string> = {
  condicoes_gerais: 'Condições Gerais de Saúde',
  antecedentes: 'Antecedentes Patológicos',
  historico_ocupacional: 'Histórico Ocupacional',
  habitos: 'Hábitos e Estilo de Vida',
  perguntas_femininas: 'Questionário Feminino',
  antecedentes_familiares: 'Antecedentes Familiares',
};

export const GRUPO_ICONS: Record<AnamneseGrupoKey, string> = {
  condicoes_gerais: 'A',
  antecedentes: 'B',
  historico_ocupacional: 'C',
  habitos: 'D',
  perguntas_femininas: 'E',
  antecedentes_familiares: 'F',
};

export const STATUS_CONFIG: Record<QuestionarioStatus, {
  label: string;
  class: string;
}> = {
  pendente: {
    label: 'Pendente',
    class: 'bg-warning-light text-warning border-semantic-warning',
  },
  vinculado: {
    label: 'Vinculado',
    class: 'bg-primary-100/10 text-primary-100 border-primary-200',
  },
  completo: {
    label: 'Completo',
    class: 'bg-success-light text-success border-semantic-success',
  },
};

export const ORIGEM_LABELS: Record<QuestionarioOrigem, string> = {
  google_forms: 'Google Forms',
  manual: 'Preenchimento Manual',
};