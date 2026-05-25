// Autenticação
export interface User {
  // Campos novos
  id?: number;
  nome?: string;
  email?: string;
  staff_type?: string;
  is_master?: boolean;
  is_legacy?: boolean;
  permissions?: string[];
  role?: {
    id: number | null;
    name: string;
    slug: string;
  };

  // Campos legados
  usuario?: string;
  tipo?: string;
}

export interface LoginCredentials {
  usuario: string;
  senha: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

// Refs
export interface EmpresaRef {
  id: number;
  nome: string;
  cnpj: string; // formatado pelo backend
}

export interface ConvenioRef {
  id: number;
  nome: string;
  cnpj: string; // formatado
  emite_guia?: boolean;
}

// Pacientes
export interface Paciente {
  id?: number;

  nome: string;

  cpf: string; // formatado XXX.XXX.XXX-XX
  cpf_raw?: number; // raw numérico (backend pode enviar)

  data_de_nascimento: string; // YYYY-MM-DD (no controller novo) ou DD/MM/YYYY (model legacy)
  data_de_nascimento_br?: string; // DD/MM/YYYY (controller)
  idade?: number;

  sexo?: 'M' | 'F' | null;

  numero_de_contato?: number | string | null; // backend pode mandar int/string/null
  email?: string | null;

  // Endereço legado (string única)
  endereco?: string | null;

  // Endereço estruturado (novo)
  cep?: string | null; // pode vir formatado (00000-000)
  cep_raw?: string | null; // opcional: 8 dígitos
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;

  /**
   * Campo de compatibilidade para UI/cards:
   * controller monta uma string com base no endereço estruturado e/ou legado.
   */
  endereco_compacto?: string | null;

  vinculado_a_empresa: boolean;
  cnpj_empresa?: string | null; // formatado
  cnpj_empresa_raw?: number | null; // raw
  empresa?: EmpresaRef | null;

  vinculado_a_convenio: boolean;
  cnpj_convenio?: string | null; // formatado
  cnpj_convenio_raw?: number | null; // raw
  convenio?: ConvenioRef | null;

  /**
   * Alguns endpoints antigos/UI podem usar nome_empresa direto.
   * Mantemos opcional para evitar `as any`.
   */
  nome_empresa?: string | null;
  nome_convenio?: string | null;
}

// Prontuário (anamnese ao longo das consultas)
export interface ProntuarioConsulta {
  id: number;
  cpf?: number | string | null;
  nome_do_paciente?: string | null;
  nome_do_medico?: string | null;
  procedimentos?: string | null;
  data?: string | null; // YYYY-MM-DD
  hora?: string | null; // HH:MM
  crm_medico?: number | string | null;
  tipo?: string | null;
  houve_solicitacao_de_exame?: boolean | null;
  houve_prescricao_medicamentos?: boolean | null;
  medicamentos_prescrevidos?: string | null;
  anamnese?: string | null;
  // Campos adicionais para prontuário detalhado
  diagnostico?: string | null;
  conduta?: string | null;
  queixa_principal?: string | null;
  historia_doenca_atual?: string | null;
  exame_fisico?: string | null;
  cid?: string | null;
  observacoes_internas?: string | null;
}

export interface ProntuarioResponse {
  paciente: Paciente;
  consultas: ProntuarioConsulta[];
}

// Agendamentos
export type AgendamentoStatus = 'AGENDADO' | 'CONFIRMADO' | 'REALIZADO' | 'CANCELADO' | 'FALTOU';

export type AgendamentoProcedimento =
  | 'Consulta Ocupacional'
  | 'Exame Admissional'
  | 'Exame Demissional'
  | 'Exame Periódico'
  | 'Retorno'
  | 'IMESC'
  | string;

export interface Agendamento {
  id?: number;

  dia: string; // YYYY-MM-DD (backend envia iso date)
  hora: string; // HH:MM:SS ou HH:MM

  cpf_paciente?: string | number | null;
  nome_paciente?: string | null;

  procedimento?: AgendamentoProcedimento | null;

  numero_de_contato?: string | number | null;
  numero_de_protocolo?: string | number | null;

  paciente_compareceu?: boolean | null;

  status?: AgendamentoStatus;

  observacoes?: string | null;
}

// Consultas
export interface Consulta {
  id: number;
  cpf?: number | string | null;
  nome_do_paciente?: string | null;
  nome_do_medico?: string | null;
  procedimentos?: string | null;
  data?: string | null; // YYYY-MM-DD
  hora?: string | null; // HH:MM
  crm_medico?: number | string | null;
  tipo?: string | null;
  houve_solicitacao_de_exame?: boolean | null;
  houve_prescricao_medicamentos?: boolean | null;
  medicamentos_prescrevidos?: string | null;
  anamnese?: string | null;
}

// Médicos
export interface Medico {
  id?: number;
  nome: string;
  data_de_nascimento: string;
  especialidade?: string;
  cpf: string;
  crm: string;
  sexo: 'M' | 'F';
  telefone?: string;
  email?: string;
}

// Empresas
export interface Empresa {
  id?: number;
  cnpj: string;
  nome: string;
  numero_para_contato?: string;
  email?: string;
  endereco?: string;
  responsavel?: string;
}

// Convênios
export interface Convenio {
  id?: number;
  cnpj: string;
  nome: string;
  numero_para_contato?: string;
  email?: string;
  emite_guia: boolean;
}

// Pagamentos
export type PagamentoTipo = 'PIX' | 'DINHEIRO' | 'DÉBITO' | 'CRÉDITO' | 'TRANSFERÊNCIA BANCÁRIA';
export type PagamentoOrigem = 'PACIENTE' | 'EMPRESA' | 'CONVÊNIO' | 'OUTROS';
export type PagamentoTipoPessoaPix = 'PF' | 'PJ';
export type PagamentoContaDestino = 'PF' | 'PJ';

export interface Pagamento {
  id?: number;

  tipo: PagamentoTipo;

  /**
   * No backend é number, mas no form do frontend você usa string (input).
   * Mantemos flexível para não quebrar o build.
   */
  valor: number | string;

  possui_desconto: boolean;
  valor_desconto?: number | string | null;

  data: string; // YYYY-MM-DD

  nome_do_paciente?: string | null;
  cpf?: string | null;

  /**
   * No backend são IDs numéricos (empresa_id / convenio_id).
   * No form você manipula como string e converte para number no payload.
   */
  empresa_id?: number | string | null;
  convenio_id?: number | string | null;

  origem: PagamentoOrigem | string;

  nome_empresa?: string | null;
  nome_convenio?: string | null;

  descricao?: string | null;
  qtd_parcelas_credito?: number | null;

  // Para PIX: tipo de pessoa que está pagando
  tipo_pessoa_pix?: PagamentoTipoPessoaPix | null;

  conta_destinada_pix?: PagamentoContaDestino | null;

  // Campos de nota fiscal
  vinculado_nota_fiscal?: boolean;
  numero_nota_fiscal?: string | null;

  // opcionais úteis que o backend pode devolver (ex: calculado)
  valor_liquido?: number;
}

// Financeiro (Resumo mensal)
export interface ResumoMensalPagamentos {
  total_bruto: number;
  total_descontos: number;
  total_liquido: number;
  por_tipo: { tipo: string; total: number }[];
  por_origem: { origem: string; total: number }[];
  mes: number;
  ano: number;
}

// Exames
export interface Exame {
  id?: number;
  nome: string;
  tipo: string;
  valor_cmi: number;
  valor_parceiro: number;
}

export interface SolicitacaoExame {
  id?: number;
  cpf_paciente: string;
  nome_paciente: string;
  data: string;
  hora: string;
  exames: string;
  soma_dos_valores: number;
  status: 'PENDENTE' | 'FATURADO' | 'EXTERNO' | 'CANCELADO';
}

// Dashboard
export interface DashboardStats {
  totalPacientes: number;
  consultasHoje: number;
  consultasMes: number;
  agendamentosHoje: number;
  agendamentosAmanha: number;
  faturamentoMes: number;
  faturamentoMesAnterior: number;
  taxaOcupacao: number;
}

export interface AtividadeRecente {
  id: number;
  tipo: 'consulta' | 'agendamento' | 'pagamento' | 'paciente';
  titulo: string;
  descricao: string;
  horario: string;
}

// Relatórios
export interface RelatorioFiltros {
  data_inicio?: string;
  data_fim?: string;
  tipo?: string;

  // compat (caso use por ID numérico)
  empresa_id?: number;
  convenio_id?: number;

  // usado hoje no backend do PDF: patient/company/insurance
  filtro_id?: string;
}

export interface PacienteFrequente {
  cpf: string;
  nome: string;
  total_consultas: number;
  ultima_consulta: string;
  empresa?: string;
}

export interface ConsultaPorPeriodo {
  data: string;
  total: number;
  tipo_consulta?: string;
}

export interface FaturamentoMensal {
  mes: number;
  ano: number;
  nome_mes: string;
  receitas: number;
  despesas: number;
  lucro: number;
}

// Props de componentes comuns
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface SelectOption {
  value: string | number;
  label: string;
}

// Paginação
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Resposta genérica da API
export interface ApiResponse<T> {
  data: T;
  message?: string;
  pagination?: PaginationInfo;
}

// Estado de loading
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

// ============================================
// Analytics types
// ============================================
export * from './analytics.types';
