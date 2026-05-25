/**
 * Types para o módulo de Auditoria v2 — Narrativo & Insights
 *
 * Alinhado com o novo formato de details do backend:
 * - summary: frase-resumo legível
 * - resource_label: nome legível do recurso
 * - display_name: nome do objeto afetado
 * - fields/changes/deleted_fields: dados estruturados com labels
 */

// =============================================================================
// Core Audit Log
// =============================================================================

/** Campo estruturado com label (usado em create e delete) */
export interface AuditField {
  field: string;
  label: string;
  value: unknown;
}

/** Mudança de campo com label (usado em update) */
export interface AuditChange {
  old: unknown;
  new: unknown;
  label: string;
}

export type AuditAction = 'create' | 'update' | 'delete';

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_nome: string | null;
  user_type: string | null;
  action: AuditAction;
  resource: string;
  resource_id: string | null;
  ip_address: string | null;
  created_at: string | null;

  // Campos extraídos do details (v2)
  summary: string | null;
  resource_label: string | null;
  display_name: string | null;

  // Detalhes por tipo de ação (presentes no modo completo)
  fields?: AuditField[];
  changes?: Record<string, AuditChange>;
  deleted_fields?: AuditField[];

  // Compatibilidade com logs antigos
  details?: Record<string, unknown>;
  details_raw?: Record<string, unknown>;
}

export interface AuditLogFilters {
  user_id?: number;
  action?: AuditAction | '';
  resource?: string;
  resource_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  compact?: boolean;
}

export interface AuditLogListResponse {
  total: number;
  limit: number;
  offset: number;
  logs: AuditLog[];
}

// =============================================================================
// Resource History (NOVO endpoint)
// =============================================================================
export interface ResourceHistoryResponse {
  resource: string;
  resource_id: string;
  resource_label: string;
  total: number;
  timeline: AuditLog[];
}

// =============================================================================
// Stats
// =============================================================================
export interface AuditStats {
  total: number;
  anonymous_actions: number;
  by_action: { action: string; label: string; count: number }[];
  by_resource: { resource: string; label: string; count: number }[];
  top_users: {
    user_id: number;
    user_nome: string | null;
    user_type: string | null;
    count: number;
  }[];
}

// =============================================================================
// Resources
// =============================================================================
export interface AuditResource {
  key: string;
  label: string;
}

// =============================================================================
// Insights
// =============================================================================
export interface NarrativeCard {
  type: 'success' | 'warning' | 'info' | 'highlight' | 'attention';
  icon: string;
  title: string;
  description: string;
  metric?: Record<string, unknown>;
}

export interface UserProfile {
  user_id: number;
  user_nome: string | null;
  user_type: string | null;
  total_actions: number;
  active_days: number;
  peak_hour: number | null;
  favorite_resource: string;
  favorite_resource_label: string;
  favorite_resource_pct: number;
  resources_count: number;
  action_breakdown: Record<string, number>;
  top_resources: { resource: string; label: string; count: number }[];
  phrases: string[];
}

export interface TimelinePoint {
  date: string;
  count: number;
}

export interface HeatmapPoint {
  weekday: number;
  hour: number;
  count: number;
}

export interface ResourceTrend {
  resource: string;
  label: string;
  count: number;
  previous: number;
  delta: number;
  delta_pct: number | null;
}

export interface ActionDistribution {
  action: string;
  label: string;
  count: number;
}

export interface AuditInsightsResponse {
  period_days: number;
  total_actions: number;
  narrative_cards: NarrativeCard[];
  user_profiles: UserProfile[];
  activity_timeline: TimelinePoint[];
  heatmap_data: HeatmapPoint[];
  resource_trend: ResourceTrend[];
  action_distribution: ActionDistribution[];
}

// =============================================================================
// Helpers de label e config visual
// =============================================================================
export const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  create: { label: 'Criação', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: '➕' },
  update: { label: 'Edição', color: 'text-blue-600', bg: 'bg-blue-50', icon: '✏️' },
  delete: { label: 'Exclusão', color: 'text-red-600', bg: 'bg-red-50', icon: '🗑️' },
};

export const RESOURCE_LABELS: Record<string, string> = {
  pacientes: 'Pacientes',
  medicos: 'Médicos',
  consultas: 'Consultas',
  agendamentos: 'Agendamentos',
  exames: 'Exames',
  exames_clinica: 'Exames Clínicos',
  pagamentos: 'Pagamentos',
  empresas: 'Empresas',
  empresa_setores: 'Setores',
  empresa_cargos: 'Cargos',
  vinculos_empregaticios: 'Vínculos',
  convenios: 'Convênios',
  prontuarios: 'Prontuários',
  receituarios: 'Receituários',
  itens_receituario: 'Itens de Receituário',
  medicamentos: 'Medicamentos',
  lotes_medicamento: 'Lotes',
  fornecedores: 'Fornecedores',
  estoque_movimentacoes: 'Movimentações',
  pericias_imesc: 'Perícias IMESC',
  feriados: 'Feriados',
  procedimentos: 'Procedimentos',
  solicitacoes_exames: 'Solicitações de Exame',
  aso_requests: 'ASOs',
  assistentes_sociais: 'Assistentes Sociais',
};

export function getResourceLabel(resource: string): string {
  return RESOURCE_LABELS[resource] || resource.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export const CARD_TYPE_STYLES: Record<NarrativeCard['type'], { border: string; bg: string; text: string }> = {
  success: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' },
  info: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700' },
  highlight: { border: 'border-violet-200', bg: 'bg-violet-50', text: 'text-violet-700' },
  attention: { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-700' },
};

export const WEEKDAY_LABELS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];