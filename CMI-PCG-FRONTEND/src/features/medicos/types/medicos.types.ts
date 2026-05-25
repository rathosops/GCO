/**
 * Tipos do Módulo de Médicos
 * 
 * @module features/medicos/types
 */

// ============================================
// Tipos Base
// ============================================

export interface MedicoEstatisticas {
  total_consultas: number;
  consultas_mes: number;
  consultas_ano: number;
  pacientes_unicos: number;
  pacientes_ultimo_ano: number;
  media_mensal: number;
  por_tipo: { tipo: string; total: number }[];
  primeira_consulta: string | null;
  ultima_consulta: string | null;
}

export interface Medico {
  id: number;
  nome: string;
  cpf: string;
  cpf_raw?: number;
  crm: number;
  crm_formatado: string;
  especialidade: string | null;
  sexo: 'M' | 'F';
  rqe: number | null;
  data_de_nascimento: string;
  data_de_nascimento_br?: string;
  idade?: number;
  estatisticas?: MedicoEstatisticas;
}


// ============================================
// Filtros e Paginação
// ============================================

export type MedicoOrder = 'nome_asc' | 'nome_desc' | 'crm_asc' | 'crm_desc' | 'consultas_desc';

export interface MedicoFilters {
  search?: string;
  nome?: string;
  cpf?: string;
  crm?: string;
  especialidade?: string;
  sexo?: 'M' | 'F' | '';
  include_stats?: boolean;
  order?: MedicoOrder;
  limit?: number;
  offset?: number;
}


// ============================================
// Estatísticas Gerais
// ============================================

export interface MedicosStats {
  total_medicos: number;
  medicos_ativos_30_dias: number;
  total_consultas: number;
  media_consultas_por_medico: number;
  por_sexo: {
    masculino: number;
    feminino: number;
  };
  por_especialidade: {
    especialidade: string;
    total: number;
  }[];
}


// ============================================
// Performance Individual
// ============================================

export interface HistoricoMensal {
  ano: number;
  mes: number;
  mes_nome: string;
  total: number;
}

export interface DistribuicaoSemana {
  dia: string;
  total: number;
}

export interface PacienteFrequenteMedico {
  nome: string;
  cpf: string;
  total_consultas: number;
}

export interface MedicoPerformance {
  medico: Medico;
  periodo: string;
  metricas: {
    total_consultas: number;
    pacientes_unicos: number;
    media_consultas_dia: number | null;
  };
  historico_mensal: HistoricoMensal[];
  por_tipo: { tipo: string; total: number }[];
  distribuicao_semana: DistribuicaoSemana[];
  pacientes_frequentes: PacienteFrequenteMedico[];
}


// ============================================
// Relatórios
// ============================================

export interface RelatorioResumoMedicos {
  periodo: string;
  totais: {
    total_medicos: number;
    medicos_ativos: number;
    total_consultas: number;
    pacientes_atendidos: number;
  };
  metricas: {
    taxa_ocupacao: number;
    media_consultas_por_medico: number;
  };
  distribuicao_especialidade: {
    especialidade: string;
    total_medicos: number;
    total_consultas: number;
  }[];
}

export interface MedicoRanking {
  posicao: number;
  id: number;
  nome: string;
  crm: number;
  crm_formatado: string;
  especialidade: string | null;
  total_consultas: number;
  pacientes_unicos: number;
}

export interface RelatorioConsultasPorMedico {
  periodo: string;
  total_medicos: number;
  ranking: MedicoRanking[];
}

export interface EspecialidadeStats {
  especialidade: string;
  total_medicos: number;
  total_consultas: number;
  pacientes_unicos: number;
  media_por_medico: number;
}

export interface RelatorioPorEspecialidade {
  periodo: string;
  total_especialidades: number;
  especialidades: EspecialidadeStats[];
}

export interface ProdutividadeMensal {
  ano: number;
  mes: number;
  mes_nome: string;
  total_consultas: number;
  medicos_ativos: number;
  pacientes_atendidos: number;
  media_por_medico: number;
}

export interface RelatorioProdutividade {
  periodo_meses: number;
  historico: ProdutividadeMensal[];
  totais: {
    total_consultas: number;
    media_mensal: number;
  };
}

export interface OcupacaoSemana {
  dia: string;
  dia_numero: number;
  total: number;
}

export interface OcupacaoHorario {
  hora: number;
  faixa: string;
  total: number;
}

export interface RelatorioOcupacao {
  periodo: string;
  ocupacao_semana: OcupacaoSemana[];
  ocupacao_horario: OcupacaoHorario[];
  insights: {
    dia_mais_movimentado: string | null;
    horario_pico: string | null;
  };
}


// ============================================
// Autocomplete
// ============================================

export interface MedicoAutocomplete {
  id: number;
  nome: string;
  crm: number;
  crm_formatado: string;
  especialidade: string | null;
}


// ============================================
// Respostas da API
// ============================================

export interface MedicoCreateResponse {
  message: string;
  medico: Medico;
}

export interface MedicoUpdateResponse {
  message: string;
  medico: Medico;
}

export interface MedicoDeleteResponse {
  message: string;
}


// ============================================
// Formulário
// ============================================

export type MedicoFormMode = 'create' | 'edit';

export interface MedicoFormData {
  nome: string;
  cpf: string;
  crm: string;
  data_de_nascimento: string;
  sexo: 'M' | 'F' | '';
  especialidade: string;
  rqe: string;
}

export const INITIAL_MEDICO_FORM: MedicoFormData = {
  nome: '',
  cpf: '',
  crm: '',
  data_de_nascimento: '',
  sexo: '',
  especialidade: '',
  rqe: '',
};

export const ESPECIALIDADES_COMUNS = [
  'Medicina do Trabalho',
  'Medicina Ocupacional',
  'Clínica Geral',
  'Clínica Médica',
  'Cardiologia',
  'Ortopedia',
  'Neurologia',
  'Dermatologia',
  'Oftalmologia',
  'Otorrinolaringologia',
  'Ginecologia',
  'Pediatria',
  'Psiquiatria',
  'Urologia',
  'Endocrinologia',
  'Gastroenterologia',
  'Pneumologia',
  'Reumatologia',
  'Geriatria',
  'Anestesiologia',
];