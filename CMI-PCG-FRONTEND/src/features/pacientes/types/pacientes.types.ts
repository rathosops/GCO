/**
 * Tipos do Módulo de Pacientes
 *
 * @module features/pacientes/types
 */

// ============================================
// Tipos Base
// ============================================

export type NivelFidelidade = 'novo' | 'bronze' | 'prata' | 'ouro';

export interface PacienteFrequencia {
  total_consultas: number;
  primeira_consulta: string | null;
  ultima_consulta: string | null;
  media_dias_entre_consultas: number | null;
  consultas_ultimo_ano: number;
  consultas_ultimo_mes: number;
  nivel_fidelidade: NivelFidelidade;
  pontos_fidelidade: number;
  ultimas_consultas?: Array<{
    id: number;
    data: string;
    tipo?: string;
  }>;
}

export interface Empresa {
  id: number;
  nome: string;
  cnpj: string;
}

export interface Convenio {
  id: number;
  nome: string;
  cnpj: string;
  emite_guia?: boolean;
  is_imesc?: boolean;
}

export interface Paciente {
  id: number;
  nome: string;
  cpf: string;
  data_de_nascimento: string;
  data_de_nascimento_br?: string;
  idade?: number;
  sexo?: 'M' | 'F';
  numero_de_contato?: string | number;
  email?: string;

  // Endereço estruturado
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;

  // Endereço legado
  endereco?: string;
  endereco_compacto?: string;

  // Vínculos
  vinculado_a_empresa?: boolean;
  cnpj_empresa?: string;
  empresa?: Empresa | null;

  vinculado_a_convenio?: boolean;
  cnpj_convenio?: string;
  convenio?: Convenio | null;

  // ✅ IMESC
  protocolo_imesc?: string | null;
  is_imesc?: boolean;

  // Frequência (quando include_frequency=true)
  frequencia?: PacienteFrequencia;

  // Timestamps
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Pacientes Frequentes
// ============================================

export interface PacienteFrequente {
  id: number;
  nome: string;
  cpf: string;
  total_consultas: number;
  nivel_fidelidade: NivelFidelidade;
  pontos_fidelidade: number;
  ultima_consulta?: string;
}

// ============================================
// Prontuário
// ============================================

export interface ProntuarioConsulta {
  id: number;
  data: string;
  data_consulta?: string;
  tipo?: string;
  profissional?: string;
  queixa_principal?: string;
  hipotese_diagnostica?: string;
  conduta?: string;
  prescricao?: string;
  exames_solicitados?: string[];
  observacoes?: string;
}

export interface ProntuarioResponse {
  paciente: {
    id: number;
    nome: string;
    cpf: string;
    idade?: number;
  };
  consultas: ProntuarioConsulta[];
  total_consultas: number;
}

// ============================================
// Filtros e Paginação
// ============================================

export type PacienteOrder = 'nome_asc' | 'nome_desc' | 'recente' | 'antigo';

export interface PacienteFilters {
  search?: string;
  cpf?: string;
  nome?: string;
  sexo?: 'M' | 'F' | '';
  vinculado_a_empresa?: boolean | '';
  vinculado_a_convenio?: boolean | '';
  cidade?: string;
  uf?: string;
  nivel_fidelidade?: NivelFidelidade | '';
  include_frequency?: boolean;
  limit?: number;
  offset?: number;
  order?: PacienteOrder;
}

// ============================================
// Estatísticas
// ============================================

export interface PacientesStats {
  total_pacientes: number;
  pacientes: number;
  vinculados_empresa: number;
  vinculados_convenio: number;
  particulares: number;
  novos_este_mes?: number;
  ativos_ultimo_ano?: number;
}

export interface FidelidadeStats {
  novo: number;
  bronze: number;
  prata: number;
  ouro: number;
}

// ============================================
// Relatórios
// ============================================

export interface RelatorioResumo {
  periodo: string;
  totais: {
    total_pacientes: number;
    pacientes: number;
    vinculados_empresa: number;
    vinculados_convenio: number;
    particulares: number;
  };
  periodo_stats: {
    consultas: number;
    pacientes_atendidos: number;
    media_consultas_paciente: number;
    taxa_retorno: number;
    taxa_retorno_percent: number;
  };
  distribuicao_sexo: {
    masculino: number;
    feminino: number;
    nao_informado: number;
  };
  distribuicao_faixa_etaria?: {
    faixa: string;
    quantidade: number;
  }[];
}

export interface ConsultasPorMes {
  mes: string;
  ano: number;
  mes_nome?: string;
  total_consultas: number;
  pacientes_unicos: number;
}

export interface PacientesPorEmpresa {
  id: number;
  nome: string;
  cnpj: string;
  total_pacientes: number;
}

export interface PacientesPorConvenio {
  id: number;
  nome: string;
  cnpj: string;
  total_pacientes: number;
}

export interface DistribuicaoGeograficaUF {
  uf: string;
  total: number;
  percentual: number;
}

export interface DistribuicaoGeograficaCidade {
  cidade: string;
  uf: string;
  total: number;
  percentual: number;
}

export interface TopPacienteFidelidade {
  posicao: number;
  id: number;
  nome: string;
  total_consultas: number;
  pontos: number;
  pontos_fidelidade: number;
  nivel: NivelFidelidade;
  nivel_fidelidade: NivelFidelidade;
}

export interface RelatorioFidelidade {
  distribuicao_niveis: FidelidadeStats;
  total_pontos_emitidos: number;
  top_pacientes: TopPacienteFidelidade[];
  regras_programa: {
    pontos_por_consulta: number;
    niveis: Record<
    NivelFidelidade,
      {
  min_consultas: number;
  max_consultas: number | null;
  beneficio: string;
}
    >;
bronze: { min_consultas: number; desconto: number };
prata: { min_consultas: number; desconto: number };
ouro: { min_consultas: number; desconto: number };
  };
}

export interface Aniversariante {
  id: number;
  nome: string;
  cpf: string;
  data_nascimento: string;
  data_nascimento_br?: string;
  dia: number;
  mes: number;
  idade?: number;
  telefone?: string;
  email?: string;
}

export interface PacienteInativo {
  id: number;
  nome: string;
  cpf: string;
  ultima_consulta: string;
  ultima_consulta_br?: string;
  dias_sem_consulta: number;
  telefone?: string;
  email?: string;
}


// ============================================
// Autocomplete
// ============================================

export interface PacienteAutocomplete {
  id: number;
  nome: string;
  cpf: string;
  idade?: number;
}


// ============================================
// Respostas da API
// ============================================

export interface PacienteCreateResponse {
  message: string;
  id: number;
  paciente: Paciente;
}

export interface PacienteUpdateResponse {
  message: string;
  paciente: Paciente;
}

export interface PacienteDeleteResponse {
  message: string;
}

export interface PacientesFrequentesResponse {
  total: number;
  pacientes: PacienteFrequente[];
}

export interface FrequenciaResponse {
  paciente: {
    id: number;
    nome: string;
    cpf: string;
  };
  frequencia: PacienteFrequencia;
}


// ============================================
// Formulário
// ============================================

export type PacienteFormMode = 'create' | 'edit';

/** Empresa/Convênio selecionado no picker */
export interface EmpresaSelected {
  id: number;
  nome: string;
  cnpj: string;
}

export interface ConvenioSelected {
  id: number;
  nome: string;
  cnpj: string;
  emite_guia?: boolean;
}

export interface PacienteFormData {
  nome: string;
  cpf: string;
  data_de_nascimento: string;
  sexo: 'M' | 'F' | '';
  numero_de_contato: string;
  email: string;

  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  endereco: string;

  vinculado_a_empresa: boolean;
  cnpj_empresa: string;
  empresa_selecionada: EmpresaSelected | null;

  vinculado_a_convenio: boolean;
  cnpj_convenio: string;
  convenio_selecionado: ConvenioSelected | null;

  // ✅ IMESC
  protocolo_imesc: string;
}

export const INITIAL_PACIENTE_FORM: PacienteFormData = {
  nome: '',
  cpf: '',
  data_de_nascimento: '',
  sexo: '',
  numero_de_contato: '',
  email: '',

  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  endereco: '',

  vinculado_a_empresa: false,
  cnpj_empresa: '',
  empresa_selecionada: null,

  vinculado_a_convenio: false,
  cnpj_convenio: '',
  convenio_selecionado: null,

  // ✅ IMESC
  protocolo_imesc: '',
};