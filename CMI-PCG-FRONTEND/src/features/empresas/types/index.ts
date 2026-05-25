/**
 * Tipos do Módulo de Empresas — Ocupacional
 * @module features/empresas/types
 */

// =============================================================================
// Empresa
// =============================================================================

export interface Empresa {
    id: number;
    cnpj: string;
    cnpj_raw?: number;
    razao_social: string;
    nome: string;
    cnae?: string | null;
    cnae_descricao?: string | null;
    grau_risco?: 1 | 2 | 3 | 4 | null;
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    numero_para_contato?: string | number | null;
    email?: string | null;
    contato_rh_nome?: string | null;
    contato_rh_telefone?: string | number | null;
    contato_rh_email?: string | null;
    inscricao_estadual?: string | null;
    inscricao_municipal?: string | null;
    ativo: boolean;
    observacoes?: string | null;
    total_pacientes?: number;
    created_at?: string;
    updated_at?: string;

    // Faturamento posterior
    faturamento_posterior?: boolean;
    dia_faturamento?: number | null;
    valor_por_consulta?: number | null;
    valor_por_aso?: number | null;
    observacoes_faturamento?: string | null;
}

export type EmpresaCompact = Pick<Empresa, "id" | "cnpj" | "nome" | "faturamento_posterior">;

// =============================================================================
// Setor
// =============================================================================

export interface RiscosOcupacionais {
    fisico?: string[];
    quimico?: string[];
    biologico?: string[];
    ergonomico?: string[];
    acidente?: string[];
}

export interface Setor {
    id: number;
    empresa_id: number;
    nome: string;
    descricao?: string | null;
    riscos_ocupacionais: RiscosOcupacionais;
    ativo: boolean;
    cargos?: Cargo[];
    total_cargos?: number;
    created_at?: string;
    updated_at?: string;
}

// =============================================================================
// Cargo
// =============================================================================

export interface ExamesObrigatorios {
    admissional?: string[];
    periodico?: string[];
    retorno_trabalho?: string[];
    mudanca_funcao?: string[];
    demissional?: string[];
}

export interface Cargo {
    id: number;
    empresa_id: number;
    setor_id?: number | null;
    setor_nome?: string | null;
    nome: string;
    cbo?: string | null;
    descricao?: string | null;
    riscos_ocupacionais: RiscosOcupacionais;
    exames_obrigatorios: ExamesObrigatorios;
    nrs_aplicaveis: Record<string, boolean>;
    periodicidade_meses: number;
    manipula_alimentos: boolean;
    ativo: boolean;
    riscos_completos?: RiscosOcupacionais;
    total_trabalhadores_ativos?: number;
    created_at?: string;
    updated_at?: string;
}

// =============================================================================
// Trabalhadores / Vínculos
// =============================================================================

export type StatusVinculo = "ATIVO" | "AFASTADO" | "FERIAS" | "DESLIGADO";
export type StatusTrabalhador = StatusVinculo | "LEGADO";

/**
 * Mantém o tipo "Vinculo" para o novo modelo (tabela de vínculos)
 */
export interface Vinculo {
    id: number;
    paciente_id: number;
    empresa_id: number;
    cargo_id?: number | null;
    setor_id?: number | null;
    matricula?: string | null;
    funcao: string;
    data_admissao: string;
    data_desligamento?: string | null;
    status: StatusVinculo;

    // campos de suporte para UI
    paciente_nome?: string;
    paciente_cpf?: string;
    empresa_nome?: string;
    cargo_nome?: string;
    setor_nome?: string;

    riscos_completos?: RiscosOcupacionais;
    exames_obrigatorios?: ExamesObrigatorios;
    nrs_aplicaveis?: Record<string, boolean>;

    created_at?: string;
    updated_at?: string;
}

/**
 * Tipo para registro legado (ex.: paciente vinculado “antigo” sem registro em VinculosEmpregado).
 * Observação: o backend pode devolver um "id" artificial; então tratamos campos como opcionais.
 */
export interface TrabalhadorLegado {
    id: number; // id artificial/derivado para a linha (para key do React)
    paciente_id: number;
    empresa_id: number;
    status: "LEGADO";

    paciente_nome?: string;
    paciente_cpf?: string;
    empresa_nome?: string;

    // pode existir ou não no legado
    funcao?: string | null;
    data_admissao?: string | null;
    matricula?: string | null;
    cargo_nome?: string | null;
    setor_nome?: string | null;
}

export type Trabalhador = Vinculo | TrabalhadorLegado;

export const STATUS_VINCULO_OPTIONS: {
    value: StatusTrabalhador;
    label: string;
    color: string;
}[] = [
        { value: "ATIVO", label: "Ativo", color: "bg-green-100 text-green-700" },
        { value: "AFASTADO", label: "Afastado", color: "bg-amber-100 text-amber-700" },
        { value: "FERIAS", label: "Férias", color: "bg-blue-100 text-blue-700" },
        { value: "DESLIGADO", label: "Desligado", color: "bg-red-100 text-red-700" },
        { value: "LEGADO", label: "Legado", color: "bg-slate-100 text-slate-700" },
    ];

// =============================================================================
// Dashboard / Periódicos / ASO Prefill
// =============================================================================

/**
 * Interface usada pela UI (o backend retorna outro shape; o adapter no API converte)
 */
export interface EmpresaDashboard {
    empresa_id: number;
    empresa_nome: string;
    total_trabalhadores: number;
    ativos: number;
    afastados?: number;
    ferias?: number;
    desligados?: number;
    total_setores: number;
    total_cargos: number;
    total_asos_emitidos: number;
}

/**
 * Interface usada pela UI (backend retorna pendentes com {vinculo, vencimento,...})
 */
export interface PeriodicoPendente {
    vinculo_id: number;
    paciente_id: number;
    paciente_nome: string;
    funcao: string;

    cargo_nome?: string;
    setor_nome?: string;

    ultimo_aso_data?: string | null;
    periodicidade_meses: number;
    data_vencimento: string;
    dias_para_vencer: number;
    vencido: boolean;
}

/**
 * Interface usada pela UI (backend retorna outro shape; adapter no API converte)
 */
export interface AsoPrefill {
    empresa: { id: number; nome: string; cnpj: string };
    paciente: { id: number; nome: string; cpf: string };
    vinculo: {
        funcao: string;
        matricula?: string;
        setor?: string;
        cargo?: string;
        manipula_alimentos: boolean;
    };
    riscos_ocupacionais: RiscosOcupacionais;
    exames_sugeridos: ExamesObrigatorios;
    nrs_aplicaveis: Record<string, boolean>;
}

// =============================================================================
// Faturamento Posterior
// =============================================================================

/** Configuração de faturamento da empresa */
export interface FaturamentoConfig {
    faturamento_posterior: boolean;
    dia_faturamento: number | null;
    valor_por_consulta: number | null;
    valor_por_aso: number | null;
    observacoes_faturamento: string;
}

export const INITIAL_FATURAMENTO_CONFIG: FaturamentoConfig = {
    faturamento_posterior: true,
    dia_faturamento: null,
    valor_por_consulta: null,
    valor_por_aso: null,
    observacoes_faturamento: "",
};

/** Consulta de um paciente no histórico de faturamento */
export interface FaturamentoConsulta {
    id: number;
    data: string | null;
    hora: string | null;
    tipo: string | null;
    medico: string | null;
    diagnostico: string | null;
}

/** ASO de um paciente no histórico de faturamento */
export interface FaturamentoAso {
    id: number;
    data: string | null;
    tipo_exame: string;
    conclusao: string;
    medico: string | null;
}

/** Questionário de um paciente */
export interface FaturamentoQuestionario {
    id: number;
    status: string;
    origem: string;
    created_at: string | null;
}

/** Paciente com histórico completo dentro do faturamento */
export interface FaturamentoPaciente {
    id: number;
    nome: string;
    cpf: string;
    cpf_formatado: string;
    email: string | null;
    telefone: number | null;
    consultas: FaturamentoConsulta[];
    asos: FaturamentoAso[];
    questionarios: FaturamentoQuestionario[];
    total_consultas: number;
    total_asos: number;
    total_questionarios: number;
    possui_atendimento: boolean;
}

/** Dados da empresa no contexto de faturamento */
export interface FaturamentoEmpresaInfo {
    id: number;
    nome: string;
    cnpj: number;
    cnpj_formatado: string;
    valor_por_consulta: number | null;
    valor_por_aso: number | null;
    dia_faturamento: number | null;
}

/** Resposta do endpoint de pacientes com histórico */
export interface FaturamentoPacientesResponse {
    empresa: FaturamentoEmpresaInfo;
    periodo: { data_inicio: string; data_fim: string };
    pacientes: FaturamentoPaciente[];
    total_pacientes: number;
    total_pacientes_atendidos: number;
}

/** Resumo financeiro consolidado */
export interface FaturamentoResumo {
    empresa: FaturamentoEmpresaInfo;
    periodo: { data_inicio: string; data_fim: string };
    total_pacientes_vinculados: number;
    total_consultas: number;
    total_asos: number;
    subtotal_consultas: number;
    subtotal_asos: number;
    total_geral: number;
}

/** Período de filtro */
export interface FaturamentoPeriodo {
    data_inicio: string;
    data_fim: string;
}

// =============================================================================
// Forms
// =============================================================================

export interface EmpresaFormData {
    cnpj: string;
    razao_social: string;
    nome: string;
    cnae: string;
    cnae_descricao: string;
    grau_risco: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
    numero_para_contato: string;
    email: string;
    contato_rh_nome: string;
    contato_rh_telefone: string;
    contato_rh_email: string;
    inscricao_estadual: string;
    inscricao_municipal: string;
    observacoes: string;
}

export const INITIAL_EMPRESA_FORM: EmpresaFormData = {
    cnpj: "",
    razao_social: "",
    nome: "",
    cnae: "",
    cnae_descricao: "",
    grau_risco: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    numero_para_contato: "",
    email: "",
    contato_rh_nome: "",
    contato_rh_telefone: "",
    contato_rh_email: "",
    inscricao_estadual: "",
    inscricao_municipal: "",
    observacoes: "",
};

export interface SetorFormData {
    nome: string;
    descricao: string;
    riscos_ocupacionais: RiscosOcupacionais;
}
export const INITIAL_SETOR_FORM: SetorFormData = {
    nome: "",
    descricao: "",
    riscos_ocupacionais: {},
};

export interface CargoFormData {
    nome: string;
    setor_id: string;
    cbo: string;
    descricao: string;
    riscos_ocupacionais: RiscosOcupacionais;
    exames_obrigatorios: ExamesObrigatorios;
    nrs_aplicaveis: Record<string, boolean>;
    periodicidade_meses: string;
    manipula_alimentos: boolean;
}

export const INITIAL_CARGO_FORM: CargoFormData = {
    nome: "",
    setor_id: "",
    cbo: "",
    descricao: "",
    riscos_ocupacionais: {},
    exames_obrigatorios: {},
    nrs_aplicaveis: {},
    periodicidade_meses: "12",
    manipula_alimentos: false,
};

export interface VinculoFormData {
    paciente_id: string;
    funcao: string;
    data_admissao: string;
    cargo_id: string;
    setor_id: string;
    matricula: string;
}

export const INITIAL_VINCULO_FORM: VinculoFormData = {
    paciente_id: "",
    funcao: "",
    data_admissao: "",
    cargo_id: "",
    setor_id: "",
    matricula: "",
};

// =============================================================================
// Filtros
// =============================================================================

export interface EmpresaFilters {
    search?: string;
    cnae?: string;
    grau_risco?: number;
    cidade?: string;
    uf?: string;
    ativo?: boolean | string;
    compact?: boolean;
    limit?: number;
    offset?: number;
}

export interface VinculoFilters {
    status?: StatusTrabalhador | "todos";
    cargo_id?: number;
    setor_id?: number;
    search?: string;
    limit?: number;
    offset?: number;
}

// =============================================================================
// Tabs
// =============================================================================

export type EmpresaDetalheTab =
    | "info"
    | "setores"
    | "cargos"
    | "vinculos"
    | "periodicos"
    | "dashboard";

// =============================================================================
// Constantes
// =============================================================================

export const GRAU_RISCO_CONFIG: Record<
    number,
    { label: string; color: string; desc: string }
> = {
    1: {
        label: "Grau 1",
        color: "bg-green-100 text-green-700 border-green-200",
        desc: "Risco baixo",
    },
    2: {
        label: "Grau 2",
        color: "bg-blue-100 text-blue-700 border-blue-200",
        desc: "Risco moderado",
    },
    3: {
        label: "Grau 3",
        color: "bg-amber-100 text-amber-700 border-amber-200",
        desc: "Risco alto",
    },
    4: {
        label: "Grau 4",
        color: "bg-red-100 text-red-700 border-red-200",
        desc: "Risco muito alto",
    },
};

export const UF_OPTIONS = [
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS",
    "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC",
    "SE", "SP", "TO",
] as const;

export const NRS_LABELS: Record<string, string> = {
    nr1: "NR-1 Disposições Gerais",
    nr4: "NR-4 SESMT",
    nr5: "NR-5 CIPA",
    nr6: "NR-6 EPI",
    nr7: "NR-7 PCMSO",
    nr9: "NR-9 Agentes Ambientais",
    nr10: "NR-10 Eletricidade",
    nr11: "NR-11 Transporte",
    nr12: "NR-12 Máquinas",
    nr13: "NR-13 Caldeiras",
    nr15: "NR-15 Insalubridade",
    nr16: "NR-16 Periculosidade",
    nr17: "NR-17 Ergonomia",
    nr18: "NR-18 Construção",
    nr20: "NR-20 Inflamáveis",
    nr23: "NR-23 Incêndios",
    nr24: "NR-24 Sanitárias",
    nr25: "NR-25 Resíduos",
    nr33: "NR-33 Espaços Confinados",
    nr35: "NR-35 Trabalho em Altura",
};

export const CATEGORIAS_RISCO: {
    key: keyof RiscosOcupacionais;
    label: string;
    icon: string;
}[] = [
        { key: "fisico", label: "Físico", icon: "🔊" },
        { key: "quimico", label: "Químico", icon: "🧪" },
        { key: "biologico", label: "Biológico", icon: "🦠" },
        { key: "ergonomico", label: "Ergonômico", icon: "🦴" },
        { key: "acidente", label: "Acidente", icon: "⚠️" },
    ];

export const TIPO_ASO_LABELS: Record<keyof ExamesObrigatorios, string> = {
    admissional: "Admissional",
    periodico: "Periódico",
    retorno_trabalho: "Retorno ao Trabalho",
    mudanca_funcao: "Mudança de Função",
    demissional: "Demissional",
};