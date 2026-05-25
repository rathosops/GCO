/**
 * API Service para Médicos
 * 
 * @module features/medicos/api
 */

import api from '@/services/api';
import type {
  Medico,
  MedicoFilters,
  MedicosStats,
  MedicoPerformance,
  MedicoAutocomplete,
  MedicoCreateResponse,
  MedicoUpdateResponse,
  MedicoDeleteResponse,
  RelatorioResumoMedicos,
  RelatorioConsultasPorMedico,
  RelatorioPorEspecialidade,
  RelatorioProdutividade,
  RelatorioOcupacao,
} from '../types';


// Helper para extrair data de responses
const data = <T>(p: Promise<{ data: T }>): Promise<T> => p.then((r) => r.data);


// ============================================
// CRUD Principal
// ============================================

/**
 * Lista médicos com filtros opcionais
 */
export async function getMedicos(params?: MedicoFilters): Promise<Medico[]> {
  return data(api.get('/medicos', { params }));
}

/**
 * Busca médico por ID
 */
export async function getMedicoById(id: number): Promise<Medico> {
  return data(api.get(`/medicos/${id}`));
}

/**
 * Busca médico por CRM
 */
export async function getMedicoByCrm(crm: string): Promise<Medico> {
  return data(api.get(`/medicos/crm/${crm}`));
}

/**
 * Cria novo médico
 */
export async function createMedico(payload: Partial<Medico>): Promise<MedicoCreateResponse> {
  const res = await api.post('/medicos', payload);
  return res.data;
}

/**
 * Atualiza médico existente
 */
export async function updateMedico(id: number, payload: Partial<Medico>): Promise<MedicoUpdateResponse> {
  const res = await api.put(`/medicos/${id}`, payload);
  return res.data;
}

/**
 * Exclui médico
 */
export async function deleteMedico(id: number): Promise<MedicoDeleteResponse> {
  return data(api.delete(`/medicos/${id}`));
}


// ============================================
// Estatísticas e Performance
// ============================================

/**
 * Retorna estatísticas gerais dos médicos
 */
export async function getMedicosStats(): Promise<MedicosStats> {
  return data(api.get('/medicos/stats'));
}

/**
 * Retorna performance detalhada de um médico
 */
export async function getMedicoPerformance(
  id: number,
  periodo?: string
): Promise<MedicoPerformance> {
  return data(api.get(`/medicos/${id}/performance`, { params: { periodo } }));
}


// ============================================
// Autocomplete
// ============================================

/**
 * Busca rápida para autocomplete (nome ou CRM)
 */
export async function autocompleteMedicos(q: string, limit = 10): Promise<MedicoAutocomplete[]> {
  if (q.length < 2) return [];
  return data(api.get('/medicos/autocomplete', { params: { q, limit } }));
}


// ============================================
// Relatórios
// ============================================

/**
 * Relatório resumo geral
 */
export async function getRelatorioResumo(periodo?: string): Promise<RelatorioResumoMedicos> {
  return data(api.get('/medicos/relatorios/resumo', { params: { periodo } }));
}

/**
 * Ranking de médicos por consultas
 */
export async function getConsultasPorMedico(params?: {
  periodo?: string;
  limite?: number;
}): Promise<RelatorioConsultasPorMedico> {
  return data(api.get('/medicos/relatorios/consultas-por-medico', { params }));
}

/**
 * Distribuição por especialidade
 */
export async function getRelatorioPorEspecialidade(periodo?: string): Promise<RelatorioPorEspecialidade> {
  return data(api.get('/medicos/relatorios/por-especialidade', { params: { periodo } }));
}

/**
 * Análise de produtividade mensal
 */
export async function getRelatorioProdutividade(meses = 12): Promise<RelatorioProdutividade> {
  return data(api.get('/medicos/relatorios/produtividade', { params: { meses } }));
}

/**
 * Análise de ocupação de agenda
 */
export async function getRelatorioOcupacao(periodo?: string): Promise<RelatorioOcupacao> {
  return data(api.get('/medicos/relatorios/agenda-ocupacao', { params: { periodo } }));
}


// ============================================
// Export default com todos os métodos
// ============================================
export const medicosApi = {
  // CRUD
  getAll: getMedicos,
  getById: getMedicoById,
  getByCrm: getMedicoByCrm,
  create: createMedico,
  update: updateMedico,
  delete: deleteMedico,
  
  // Stats & Performance
  getStats: getMedicosStats,
  getPerformance: getMedicoPerformance,
  
  // Autocomplete
  autocomplete: autocompleteMedicos,
  
  // Relatórios
  relatorios: {
    getResumo: getRelatorioResumo,
    getConsultasPorMedico,
    getPorEspecialidade: getRelatorioPorEspecialidade,
    getProdutividade: getRelatorioProdutividade,
    getOcupacao: getRelatorioOcupacao,
  },
};

export default medicosApi;