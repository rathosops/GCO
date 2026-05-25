/**
 * Types para o módulo de Consultas
 */

// =============================================================================
// Consulta
// =============================================================================
export interface Consulta {
  id: number;
  
  // Paciente
  cpf_paciente: number | null;
  nome_paciente: string | null;
  paciente: {
    cpf: number | null;
    nome: string | null;
    sexo: string | null;
    data_nascimento: string | null;
  } | null;
  
  // Médico
  crm_medico: number | null;
  nome_medico: string | null;
  especialidade_medico: string | null;
  medico: {
    crm: number | null;
    nome: string | null;
    especialidade: string | null;
  } | null;
  
  // Data/hora
  data: string | null;
  data_br: string | null;
  hora: string | null;
  
  // Tipo
  tipo: string | null;
  procedimentos: string | null;
  
  // Anamnese expandida
  anamnese: string | null;
  queixa_principal: string | null;
  historia_doenca_atual: string | null;
  exame_fisico: string | null;
  
  // Diagnóstico
  diagnostico: string | null;
  cid: string | null;
  conduta: string | null;
  
  // Prescrições
  houve_solicitacao_de_exame: boolean;
  houve_prescricao_medicamentos: boolean;
  medicamentos_prescrevidos: string | null;
  
  // Retorno
  retorno_em: number | null;
  data_retorno: string | null;
  
  // Observações
  observacoes_internas: string | null;
  
  // Timestamps
  created_at: string | null;
  updated_at: string | null;
}

export interface ConsultaResumo {
  id: number;
  cpf_paciente: number | null;
  nome_paciente: string | null;
  crm_medico: number | null;
  nome_medico: string | null;
  data: string | null;
  data_br: string | null;
  hora: string | null;
  tipo: string | null;
  diagnostico: string | null;
  anamnese_resumo: string | null;
}

// =============================================================================
// Form Data
// =============================================================================
export interface ConsultaFormData {
  cpf_paciente: string;
  crm_medico: string;
  tipo: string;
  
  // Anamnese
  anamnese: string;
  queixa_principal?: string;
  historia_doenca_atual?: string;
  exame_fisico?: string;
  
  // Procedimentos
  procedimentos?: string;
  
  // Diagnóstico
  diagnostico?: string;
  cid?: string;
  conduta?: string;
  
  // Prescrições
  houve_solicitacao_de_exame?: boolean;
  houve_prescricao_medicamentos?: boolean;
  medicamentos_prescrevidos?: string;
  
  // Retorno
  retorno_em?: number;
  data_retorno?: string;
  
  // Observações
  observacoes_internas?: string;
  
  // Data/hora (opcional - usa atual se não informado)
  data?: string;
  hora_consulta?: string;
}

// =============================================================================
// Filtros
// =============================================================================
export interface ConsultaFilters {
  search?: string;
  cpf_paciente?: string;
  crm_medico?: string;
  tipo?: string;
  data?: string;
  data_inicio?: string;
  data_fim?: string;
  houve_exame?: boolean | '';
  houve_prescricao?: boolean | '';
  order?: ConsultaOrder;
  limit?: number;
  offset?: number;
  resumo?: boolean;
}

export type ConsultaOrder = 
  | 'data_desc' 
  | 'data_asc' 
  | 'paciente_asc' 
  | 'medico_asc';

// =============================================================================
// Estatísticas
// =============================================================================
export interface ConsultaStats {
  total: number;
  consultas_hoje: number;
  consultas_mes: number;
  com_solicitacao_exame: number;
  com_prescricao: number;
  por_tipo: { tipo: string; total: number }[];
  por_medico: { nome: string; crm: number; total: number }[];
}

// =============================================================================
// Relatórios
// =============================================================================
export interface ConsultaPorTipo {
  tipo: string;
  total: number;
  pacientes_unicos: number;
  posicao: number;
}

export interface ConsultaPorPeriodo {
  periodo: string;
  total: number;
  pacientes_unicos: number;
}

export interface ConsultaPorMedico {
  crm: number;
  nome: string;
  especialidade: string | null;
  total: number;
  pacientes_unicos: number;
  posicao: number;
}

export interface PacienteFrequente {
  cpf: number;
  nome: string;
  contato: number | null;
  total_consultas: number;
  ultima_consulta: string | null;
  primeira_consulta: string | null;
  posicao: number;
}

export interface ResumoMensal {
  ano: number;
  meses: {
    mes: number;
    nome_mes: string;
    total: number;
    pacientes_unicos: number;
    medicos_ativos: number;
  }[];
  totais: {
    total: number;
    media_mensal: number;
  };
}

// =============================================================================
// Helpers
// =============================================================================
export interface MedicoOption {
  crm: number | string;
  nome: string;
  especialidade?: string;
}

export interface ProcedimentoOption {
  id?: number;
  nome: string;
}