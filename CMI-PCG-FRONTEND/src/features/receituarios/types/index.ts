/**
 * Tipos para o módulo de Receituários Médicos
 * @module features/receituarios/types
 */

// =============================================================================
// Enums / Constantes
// =============================================================================

export type TipoReceita = "SIMPLES" | "CONTROLE_ESPECIAL" | "ANTIMICROBIANO";
export type StatusReceituario = "ATIVA" | "DISPENSADA" | "CANCELADA" | "VENCIDA";

export type FormaFarmaceutica =
  | "COMPRIMIDO"
  | "CAPSULA"
  | "SOLUCAO_ORAL"
  | "SOLUCAO_INJETAVEL"
  | "POMADA"
  | "CREME"
  | "GEL"
  | "SUSPENSAO"
  | "GOTAS"
  | "SPRAY"
  | "SUPOSITORIO"
  | "ADESIVO"
  | "PO"
  | "XAROPE"
  | "OUTRO";

export type ViaAdministracao =
  | "ORAL"
  | "SUBLINGUAL"
  | "TOPICA"
  | "INTRAVENOSA"
  | "INTRAMUSCULAR"
  | "SUBCUTANEA"
  | "RETAL"
  | "NASAL"
  | "OFTALMICA"
  | "INALATORIA"
  | "OUTRA";

// =============================================================================
// Receituário (header)
// =============================================================================

export interface Receituario {
  id: number;
  consulta_id?: number | null;
  cpf_paciente: string;
  crm_medico: number;
  tipo_receita: TipoReceita;
  data_prescricao: string; // ISO date
  data_prescricao_br?: string;
  validade_dias: number;
  data_validade: string;
  data_validade_br?: string;
  observacoes_gerais?: string | null;
  orientacoes_paciente?: string | null;
  status: StatusReceituario;
  status_efetivo?: StatusReceituario;
  motivo_cancelamento?: string | null;
  numero_vias: number;
  vencida?: boolean;
  total_itens?: number;
  total_dispensados?: number;
  tipo_descricao?: string;

  // Relacionamentos (quando incluídos)
  paciente?: {
    nome: string;
    cpf: string;
    cpf_formatado?: string;
    data_nascimento_br?: string;
    idade?: number;
    sexo?: string;
  } | null;
  medico?: {
    nome: string;
    crm: string | number;
    especialidade?: string;
    sexo?: string;
  } | null;
  itens?: ReceituarioItem[];

  // Auditoria
  created_at?: string;
  updated_at?: string;
  created_by_id?: number;
  updated_by_id?: number;
}

// =============================================================================
// Item do Receituário
// =============================================================================

export interface ReceituarioItem {
  id: number;
  receituario_id: number;
  medicamento_id?: number | null;
  nome_medicamento: string;
  principio_ativo?: string | null;
  concentracao?: string | null;
  forma_farmaceutica?: FormaFarmaceutica | string | null;
  via_administracao?: ViaAdministracao | string | null;
  posologia: string;
  quantidade?: number | null;
  unidade_quantidade?: string | null;
  duracao_dias?: number | null;
  uso_continuo?: boolean;
  is_amostra_gratis?: boolean;
  dispensado?: boolean;
  dispensado_lote_id?: number | null;
  dispensado_quantidade?: number | null;
  dispensado_em?: string | null;
  ordem: number;
  observacoes?: string | null;

  // Calculados
  descricao_completa?: string;
  is_estoque_interno?: boolean;
}

// =============================================================================
// Form Data (criação)
// =============================================================================

export interface ReceituarioItemFormData {
  medicamento_id?: number | null;
  nome_medicamento: string;
  principio_ativo?: string;
  concentracao?: string;
  forma_farmaceutica?: string;
  via_administracao?: string;
  posologia: string;
  quantidade?: number | null;
  unidade_quantidade?: string;
  duracao_dias?: number | null;
  uso_continuo?: boolean;
  is_amostra_gratis?: boolean;
  observacoes?: string;
}

export interface ReceituarioCreatePayload {
  cpf_paciente: string;
  crm_medico: number;
  tipo_receita: TipoReceita;
  consulta_id?: number | null;
  observacoes_gerais?: string;
  orientacoes_paciente?: string;
  itens: ReceituarioItemFormData[];
}

export interface ReceituarioUpdatePayload {
  observacoes_gerais?: string;
  orientacoes_paciente?: string;
}

// =============================================================================
// Filtros
// =============================================================================

export interface ReceituarioFilters {
  cpf_paciente?: string;
  crm_medico?: number | string;
  tipo_receita?: TipoReceita | "";
  status?: StatusReceituario | "";
  data_inicio?: string;
  data_fim?: string;
  limit?: number;
  offset?: number;
}

// =============================================================================
// Stats
// =============================================================================

export interface ReceituarioStats {
  total: number;
  por_tipo: Record<TipoReceita, number>;
  por_status: Record<StatusReceituario, number>;
  total_itens_dispensados?: number;
  total_amostras?: number;
}

// =============================================================================
// Dispensação de item
// =============================================================================

export interface DispensarItemPayload {
  quantidade?: number;
  observacoes?: string;
}

// =============================================================================
// Constantes visuais
// =============================================================================

export const TIPO_RECEITA_CONFIG: Record<
  TipoReceita,
  { label: string; cor: string; bg: string; border: string; icon: string; vias: number; validade: number; descricao: string }
> = {
  SIMPLES: {
    label: "Receita Simples",
    cor: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    icon: "📋",
    vias: 1,
    validade: 30,
    descricao: "Medicamentos sem controle especial. Validade de 30 dias, 1 via.",
  },
  CONTROLE_ESPECIAL: {
    label: "Controle Especial",
    cor: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: "🔒",
    vias: 2,
    validade: 30,
    descricao: "Medicamentos controlados (C1/C5 ANVISA). Validade de 30 dias, 2 vias.",
  },
  ANTIMICROBIANO: {
    label: "Antimicrobiano",
    cor: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "🦠",
    vias: 2,
    validade: 10,
    descricao: "Antibióticos e antifúngicos. Validade de 10 dias, 2 vias com retenção.",
  },
};

export const STATUS_CONFIG: Record<
  StatusReceituario,
  { label: string; cor: string; bg: string; border: string; icon: string }
> = {
  ATIVA: {
    label: "Ativa",
    cor: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    icon: "✅",
  },
  DISPENSADA: {
    label: "Dispensada",
    cor: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "💊",
  },
  CANCELADA: {
    label: "Cancelada",
    cor: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "❌",
  },
  VENCIDA: {
    label: "Vencida",
    cor: "text-gray-700",
    bg: "bg-gray-100",
    border: "border-gray-300",
    icon: "⏰",
  },
};

export const FORMA_FARMACEUTICA_LABELS: Record<string, string> = {
  COMPRIMIDO: "Comprimido",
  CAPSULA: "Cápsula",
  SOLUCAO_ORAL: "Solução oral",
  SOLUCAO_INJETAVEL: "Sol. injetável",
  POMADA: "Pomada",
  CREME: "Creme",
  GEL: "Gel",
  SUSPENSAO: "Suspensão",
  GOTAS: "Gotas",
  SPRAY: "Spray",
  SUPOSITORIO: "Supositório",
  ADESIVO: "Adesivo",
  PO: "Pó",
  XAROPE: "Xarope",
  OUTRO: "Outro",
};

export const VIA_ADMINISTRACAO_LABELS: Record<string, string> = {
  ORAL: "Via oral",
  SUBLINGUAL: "Sublingual",
  TOPICA: "Tópica",
  INTRAVENOSA: "Intravenosa (IV)",
  INTRAMUSCULAR: "Intramuscular (IM)",
  SUBCUTANEA: "Subcutânea (SC)",
  RETAL: "Retal",
  NASAL: "Nasal",
  OFTALMICA: "Oftálmica",
  INALATORIA: "Inalatória",
  OUTRA: "Outra",
};

export const UNIDADES_QUANTIDADE: { value: string; label: string }[] = [
  { value: "CP", label: "Comprimido(s)" },
  { value: "CAP", label: "Cápsula(s)" },
  { value: "ML", label: "mL" },
  { value: "MG", label: "mg" },
  { value: "G", label: "g" },
  { value: "GOTAS", label: "Gota(s)" },
  { value: "AMP", label: "Ampola(s)" },
  { value: "FRASCO", label: "Frasco(s)" },
  { value: "BISNAGA", label: "Bisnaga(s)" },
  { value: "ADESIVO", label: "Adesivo(s)" },
  { value: "UN", label: "Unidade(s)" },
];