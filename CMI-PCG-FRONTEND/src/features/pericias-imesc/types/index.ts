/**
 * Tipos para Perícias IMESC
 */

// =============================================================================
// Assistente Social
// =============================================================================
export interface AssistenteSocial {
  id: number;
  nome: string;
  data_de_nascimento?: string;
  cpf: string;
  cress: string;
  sexo?: "M" | "F";
  telefone?: string;
  email?: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AssistenteSocialAutocomplete {
  id: number;
  nome: string;
  cress: string;
  ativo: boolean;
}

// =============================================================================
// Perícia IMESC
// =============================================================================
export type PericiaStatus =
  | "aguardando_triagem"
  | "aguardando_medico"
  | "concluido"
  | "cancelado";

export interface PericiaIMESC {
  id: number;
  protocolo: string;
  cpf_paciente: string;
  nome_paciente?: string;

  data_pericia: string;
  data_pericia_br?: string;
  hora_pericia?: string;

  // Médico
  crm_medico?: number;
  nome_medico?: string;
  especialidade_medico?: string;

  // Assistente Social
  cress_assistente?: string;
  nome_assistente?: string;

  // Parecer Social
  parecer_social?: string;
  data_parecer_social?: string;

  // Parecer Médico
  parecer_medico?: string;
  conclusao_medica?: string;
  cid?: string;
  data_parecer_medico?: string;

  status: PericiaStatus;
  observacoes?: string;

  created_at?: string;
  updated_at?: string;
  created_by_id?: number;
  updated_by_id?: number;
}

// =============================================================================
// Form Data
// =============================================================================
export interface PericiaFormData {
  protocolo: string;
  cpf_paciente: string;
  data_pericia: string;
  hora_pericia?: string;
  crm_medico?: number;
  observacoes?: string;
}

export interface ParecerSocialData {
  parecer_social: string;
  cress_assistente: string;
}

export interface ParecerMedicoData {
  crm_medico?: number;
  parecer_medico: string;
  conclusao_medica: string;
  cid?: string;
}

// =============================================================================
// Filters & Stats
// =============================================================================
export interface PericiaFilters {
  search?: string;
  status?: PericiaStatus | "";
  protocolo?: string;
  cpf_paciente?: string;
  data_inicio?: string;
  data_fim?: string;
  limit?: number;
  offset?: number;
}

export interface PericiaStats {
  aguardando_triagem: number;
  aguardando_medico: number;
  concluidas: number;
  canceladas: number;
  total: number;
  pericias_hoje?: number;
  pericias_mes?: number;
}

// =============================================================================
// Constants
// =============================================================================
export const STATUS_LABELS: Record<PericiaStatus, string> = {
  aguardando_triagem: "Aguardando Triagem",
  aguardando_medico: "Aguardando Médico",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const STATUS_COLORS: Record<PericiaStatus, { bg: string; text: string }> = {
  aguardando_triagem: { bg: "bg-yellow-100", text: "text-yellow-700" },
  aguardando_medico: { bg: "bg-blue-100", text: "text-blue-700" },
  concluido: { bg: "bg-green-100", text: "text-green-700" },
  cancelado: { bg: "bg-red-100", text: "text-red-700" },
};
