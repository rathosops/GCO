/**
 * Tipos para o módulo de Farmácia / Controle de Estoque
 * @module features/farmacia/types
 */

// =============================================================================
// Fornecedor
// =============================================================================
export interface Fornecedor {
  id: number;
  nome: string;
  cnpj: string;
  razao_social?: string;
  telefone?: string;
  email?: string;
  contato_responsavel?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  ativo: boolean;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
  created_by_id?: number;
  updated_by_id?: number;
}

export type FornecedorFormData = Omit<Fornecedor, "id" | "created_at" | "updated_at" | "created_by_id" | "updated_by_id">;

// =============================================================================
// Medicamento (catálogo)
// =============================================================================
export type ClassificacaoANVISA =
  | "LIVRE"
  | "SOB_PRESCRICAO"
  | "A1" | "A2" | "A3"
  | "B1" | "B2"
  | "C1" | "C2" | "C3" | "C4" | "C5";

export interface Medicamento {
  id: number;
  nome_comercial: string;
  principio_ativo: string;
  apresentacao?: string;
  forma_farmaceutica?: string;
  unidade_medida: string;
  concentracao?: string;
  classificacao_anvisa: ClassificacaoANVISA;
  classificacao_anvisa_desc?: string;
  registro_anvisa?: string;
  requer_receita_especial: boolean;
  is_controlado: boolean;
  fabricante?: string;
  estoque_minimo: number;
  estoque_maximo: number;
  ativo: boolean;
  observacoes?: string;
  // Estoque calculado
  estoque_total?: number;
  abaixo_minimo?: boolean;
  acima_maximo?: boolean;
  // Lotes (quando incluído)
  lotes?: Lote[];
  // Auditoria
  created_at?: string;
  updated_at?: string;
}

export type MedicamentoFormData = {
  nome_comercial: string;
  principio_ativo: string;
  apresentacao?: string;
  forma_farmaceutica?: string;
  unidade_medida?: string;
  concentracao?: string;
  classificacao_anvisa?: ClassificacaoANVISA;
  registro_anvisa?: string;
  fabricante?: string;
  estoque_minimo?: number;
  estoque_maximo?: number;
  observacoes?: string;
};

// =============================================================================
// Lote
// =============================================================================
export type CorValidade = "VERDE" | "LARANJA" | "VERMELHO" | "VENCIDO";

export interface Lote {
  id: number;
  medicamento_id: number;
  numero_lote: string;
  codigo_barras?: string;
  data_validade: string;
  data_validade_br?: string;
  data_fabricacao?: string;
  quantidade_inicial: number;
  quantidade_atual: number;
  preco_unitario?: number;
  fornecedor_id?: number;
  fornecedor_nome?: string;
  nota_fiscal_entrada?: string;
  localizacao?: string;
  ativo: boolean;
  // Calculados
  cor_validade: CorValidade;
  dias_para_vencer: number;
  vencido: boolean;
  disponivel: boolean;
  // Auditoria
  created_at?: string;
  updated_at?: string;
}

export type LoteFormData = {
  numero_lote: string;
  codigo_barras?: string;
  data_validade: string;
  data_fabricacao?: string;
  quantidade_inicial: number;
  preco_unitario?: number;
  fornecedor_id?: number;
  nota_fiscal_entrada?: string;
  localizacao?: string;
};

// =============================================================================
// Movimentação
// =============================================================================
export type TipoMovimentacao =
  | "ENTRADA"
  | "SAIDA"
  | "DISPENSACAO"
  | "AJUSTE_POS"
  | "AJUSTE_NEG"
  | "DESCARTE"
  | "TRANSFERENCIA";

export type MotivoDescarte = "VENCIDO" | "AVARIADO" | "CONTAMINADO" | "RECALL" | "OUTRO";

export interface Movimentacao {
  id: number;
  lote_id: number;
  numero_lote?: string;
  medicamento_id?: number;
  medicamento_nome?: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  saldo_anterior: number;
  saldo_posterior: number;
  data_movimentacao: string;
  data_movimentacao_br?: string;
  // Dispensação
  cpf_paciente?: string;
  nome_paciente?: string;
  consulta_id?: number;
  crm_medico_prescritor?: number;
  // Entrada
  fornecedor_id?: number;
  fornecedor_nome?: string;
  nota_fiscal?: string;
  // Descarte
  motivo_descarte?: MotivoDescarte;
  observacoes?: string;
  created_at?: string;
  created_by_id?: number;
}

// =============================================================================
// Dispensação
// =============================================================================
export interface DispensacaoFormData {
  medicamento_id: number;
  quantidade: number;
  cpf_paciente: string;
  consulta_id?: number;
  crm_medico_prescritor?: number;
  observacoes?: string;
}

export interface DispensacaoLoteFormData {
  lote_id: number;
  quantidade: number;
  cpf_paciente: string;
  consulta_id?: number;
  crm_medico_prescritor?: number;
  observacoes?: string;
}

// =============================================================================
// Alertas
// =============================================================================
export type TipoAlerta = "VENCIDO" | "PROXIMO_VENCER" | "ABAIXO_MINIMO";
export type Urgencia = "CRITICA" | "ALTA" | "MEDIA";

export interface AlertaEstoque {
  medicamento_id: number;
  medicamento_nome: string;
  tipo_alerta: TipoAlerta;
  detalhe: string;
  urgencia: Urgencia;
  lote_id?: number;
  numero_lote?: string;
  dias_para_vencer?: number;
  cor?: CorValidade;
}

// =============================================================================
// Dashboard
// =============================================================================
export interface DashboardEstoque {
  total_medicamentos: number;
  total_lotes_ativos: number;
  por_cor_validade: Record<CorValidade, number>;
  abaixo_minimo: number;
  valor_total_estoque: number;
  total_alertas: number;
  alertas_criticos: number;
}

// =============================================================================
// Vencimentos
// =============================================================================
export interface VencimentosPorCor {
  por_cor: Record<CorValidade, { lotes: Lote[]; total: number }>;
  resumo: Record<CorValidade, number>;
}

// =============================================================================
// Filtros
// =============================================================================
export interface MedicamentoFilters {
  search?: string;
  classificacao_anvisa?: ClassificacaoANVISA | "";
  controlado?: boolean | "";
  forma_farmaceutica?: string;
  ativo?: boolean | "";
  include_estoque?: boolean;
  limit?: number;
  offset?: number;
}

export interface MovimentacaoFilters {
  tipo?: TipoMovimentacao | "";
  medicamento_id?: number;
  lote_id?: number;
  cpf_paciente?: string;
  data_inicio?: string;
  data_fim?: string;
  limit?: number;
  offset?: number;
}

export interface FornecedorFilters {
  search?: string;
  ativo?: boolean | "";
  limit?: number;
  offset?: number;
}

// =============================================================================
// Classificações (lookup)
// =============================================================================
export interface ClassificacoesResponse {
  classificacoes: { codigo: string; descricao: string }[];
  formas_farmaceuticas: string[];
  unidades_medida: string[];
}

// =============================================================================
// Autocomplete
// =============================================================================
export interface MedicamentoAutocomplete {
  id: number;
  nome_comercial: string;
  principio_ativo: string;
  concentracao?: string;
  classificacao_anvisa: ClassificacaoANVISA;
  estoque_total: number;
}

// =============================================================================
// Tabs do módulo
// =============================================================================
export type FarmaciaTab = "dashboard" | "medicamentos" | "lotes" | "movimentacoes" | "fornecedores";

// =============================================================================
// Constantes
// =============================================================================
export const CLASSIFICACAO_LABELS: Record<ClassificacaoANVISA, string> = {
  LIVRE: "Venda livre",
  SOB_PRESCRICAO: "Sob prescrição",
  A1: "A1 – Entorpecentes",
  A2: "A2 – Entorpecentes",
  A3: "A3 – Psicotrópicos",
  B1: "B1 – Psicotrópicos",
  B2: "B2 – Psicotrópicos",
  C1: "C1 – Controle especial",
  C2: "C2 – Retinoides",
  C3: "C3 – Imunossupressores",
  C4: "C4 – Anti-retrovirais",
  C5: "C5 – Anabolizantes",
};

export const TIPO_MOVIMENTACAO_LABELS: Record<TipoMovimentacao, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  DISPENSACAO: "Dispensação",
  AJUSTE_POS: "Ajuste (+)",
  AJUSTE_NEG: "Ajuste (−)",
  DESCARTE: "Descarte",
  TRANSFERENCIA: "Transferência",
};

export const TIPO_MOVIMENTACAO_COLORS: Record<TipoMovimentacao, { bg: string; text: string }> = {
  ENTRADA: { bg: "bg-green-100", text: "text-green-700" },
  SAIDA: { bg: "bg-orange-100", text: "text-orange-700" },
  DISPENSACAO: { bg: "bg-blue-100", text: "text-blue-700" },
  AJUSTE_POS: { bg: "bg-emerald-100", text: "text-emerald-700" },
  AJUSTE_NEG: { bg: "bg-amber-100", text: "text-amber-700" },
  DESCARTE: { bg: "bg-red-100", text: "text-red-700" },
  TRANSFERENCIA: { bg: "bg-purple-100", text: "text-purple-700" },
};

export const COR_VALIDADE_CONFIG: Record<CorValidade, { bg: string; text: string; border: string; label: string; icon: string }> = {
  VERDE: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300", label: "OK (> 6 meses)", icon: "✅" },
  LARANJA: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", label: "Atenção (3–6 meses)", icon: "⚠️" },
  VERMELHO: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300", label: "Crítico (< 3 meses)", icon: "🔴" },
  VENCIDO: { bg: "bg-gray-200", text: "text-gray-700", border: "border-gray-400", label: "Vencido", icon: "⛔" },
};

export const MOTIVO_DESCARTE_LABELS: Record<MotivoDescarte, string> = {
  VENCIDO: "Vencido",
  AVARIADO: "Avariado",
  CONTAMINADO: "Contaminado",
  RECALL: "Recall",
  OUTRO: "Outro",
};

export const FORMAS_FARMACEUTICAS_LABELS: Record<string, string> = {
  COMPRIMIDO: "Comprimido",
  CAPSULA: "Cápsula",
  SOLUCAO_ORAL: "Solução oral",
  SOLUCAO_INJETAVEL: "Solução injetável",
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