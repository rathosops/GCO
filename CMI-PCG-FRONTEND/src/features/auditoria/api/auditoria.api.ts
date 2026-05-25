/**
 * API Service para Auditoria v2
 *
 * Endpoints:
 * - list: logs paginados (compact por default)
 * - getById: detalhe completo de um log
 * - getHistory: timeline de um recurso específico
 * - getStats: estatísticas agregadas
 * - getResources: recursos com labels
 * - getInsights: insights narrativos + gráficos
 */

import api from '@/services/api';
import type {
  AuditLogListResponse,
  AuditLogFilters,
  AuditLog,
  AuditStats,
  AuditResource,
  AuditInsightsResponse,
  ResourceHistoryResponse,
} from '../types';

const data = <T>(promise: Promise<{ data: T }>) => promise.then((r) => r.data);

/** Monta params ignorando valores falsy (DRY) */
function buildParams(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

export const auditoriaAPI = {
  /** Lista paginada com filtros (compact=true por default) */
  list: async (filters?: AuditLogFilters): Promise<AuditLogListResponse> => {
    const params = buildParams({
      user_id: filters?.user_id,
      action: filters?.action,
      resource: filters?.resource,
      resource_id: filters?.resource_id,
      date_from: filters?.date_from,
      date_to: filters?.date_to,
      limit: filters?.limit,
      offset: filters?.offset,
      compact: filters?.compact ?? true,
    });
    return data(api.get('/audit-logs', { params }));
  },

  /** Detalhe completo de um log */
  getById: async (id: number): Promise<AuditLog> =>
    data(api.get(`/audit-logs/${id}`)),

  /** Timeline de um recurso específico (para modal de histórico) */
  getHistory: async (resource: string, resourceId: string, limit = 50): Promise<ResourceHistoryResponse> =>
    data(api.get(`/audit-logs/history/${resource}/${resourceId}`, { params: { limit } })),

  /** Estatísticas agregadas */
  getStats: async (params?: { date_from?: string; date_to?: string }): Promise<AuditStats> =>
    data(api.get('/audit-logs/stats', { params: buildParams(params || {}) })),

  /** Lista de recursos com labels */
  getResources: async (): Promise<{ resources: AuditResource[] }> =>
    data(api.get('/audit-logs/resources')),

  /** Insights narrativos + dados para gráficos */
  getInsights: async (days = 30): Promise<AuditInsightsResponse> =>
    data(api.get('/audit-logs/insights', { params: { days } })),
};