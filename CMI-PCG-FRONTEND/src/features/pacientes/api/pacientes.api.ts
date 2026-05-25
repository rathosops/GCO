/**
 * API Service para Pacientes
 * 
 * @module features/pacientes/api
 */

import api from '@/services/api';
import type {
  Paciente,
  PacienteFilters,
  PacientesStats,
  ProntuarioResponse,
  PacienteCreateResponse,
  PacienteUpdateResponse,
  PacienteDeleteResponse,
  PacientesFrequentesResponse,
  FrequenciaResponse,
  PacienteAutocomplete,
  RelatorioResumo,
  ConsultasPorMes,
  PacientesPorEmpresa,
  PacientesPorConvenio,
  DistribuicaoGeograficaUF,
  DistribuicaoGeograficaCidade,
  RelatorioFidelidade,
  Aniversariante,
  PacienteInativo,
} from '../types';


// Helper para extrair data de responses
const data = <T>(p: Promise<{ data: T }>): Promise<T> => p.then((r) => r.data);


// ============================================
// CRUD Principal
// ============================================

/**
 * Lista pacientes com filtros opcionais
 */
export async function getPacientes(params?: PacienteFilters): Promise<Paciente[]> {
  return data(api.get('/pacientes', { params }));
}

/**
 * Busca paciente por ID
 */
export async function getPacienteById(id: number): Promise<Paciente> {
  return data(api.get(`/pacientes/${id}`));
}

/**
 * Busca paciente por CPF
 */
export async function getPacienteByCpf(cpf: string): Promise<Paciente> {
  return data(api.get(`/pacientes/cpf/${cpf}`));
}

/**
 * Cria novo paciente
 */
export async function createPaciente(payload: Partial<Paciente>): Promise<PacienteCreateResponse> {
  const res = await api.post('/pacientes', payload);
  return res.data;
}

/**
 * Atualiza paciente existente
 */
export async function updatePaciente(id: number, payload: Partial<Paciente>): Promise<PacienteUpdateResponse> {
  const res = await api.put(`/pacientes/${id}`, payload);
  return res.data;
}

/**
 * Exclui paciente
 */
export async function deletePaciente(id: number): Promise<PacienteDeleteResponse> {
  return data(api.delete(`/pacientes/${id}`));
}


// ============================================
// Estatísticas e Frequência
// ============================================

/**
 * Retorna estatísticas gerais dos pacientes
 */
export async function getPacientesStats(): Promise<PacientesStats> {
  return data(api.get('/pacientes/stats'));
}

/**
 * Retorna dados de frequência de um paciente específico
 */
export async function getPacienteFrequencia(id: number): Promise<FrequenciaResponse> {
  return data(api.get(`/pacientes/${id}/frequencia`));
}

/**
 * Lista pacientes frequentes (programa de fidelização)
 */
export async function getPacientesFrequentes(params?: {
  limite?: number;
  min_consultas?: number;
  periodo_dias?: number;
}): Promise<PacientesFrequentesResponse> {
  return data(api.get('/pacientes/frequentes', { params }));
}


// ============================================
// Prontuário e Ficha
// ============================================

/**
 * Retorna prontuário do paciente (histórico de consultas)
 */
export async function getProntuario(cpf: string): Promise<ProntuarioResponse> {
  return data(api.get('/prontuarios', { params: { cpf } }));
}

/**
 * Download da ficha do paciente em PDF
 */
export async function downloadFichaPdf(id: number): Promise<Blob> {
  const res = await api.get(`/pacientes/${id}/ficha/pdf`, { responseType: 'blob' });
  return res.data;
}

/**
 * Download do prontuário do paciente em PDF
 */
export async function downloadProntuarioPdf(id: number): Promise<Blob> {
  const res = await api.get(`/pacientes/${id}/prontuario/pdf`, { responseType: 'blob' });
  return res.data;
}


// ============================================
// Autocomplete
// ============================================

/**
 * Busca rápida para autocomplete (nome ou CPF)
 */
export async function autocompletePacientes(q: string, limit = 10): Promise<PacienteAutocomplete[]> {
  if (q.length < 2) return [];
  return data(api.get('/pacientes/autocomplete', { params: { q, limit } }));
}


// ============================================
// Pacientes por Vínculo
// ============================================

/**
 * Lista pacientes de uma empresa
 */
export async function getPacientesByEmpresa(empresaId: number): Promise<{
  empresa: { id: number; nome: string; cnpj: string };
  total: number;
  pacientes: Paciente[];
}> {
  return data(api.get(`/pacientes/empresa/${empresaId}`));
}

/**
 * Lista pacientes de um convênio
 */
export async function getPacientesByConvenio(convenioId: number): Promise<{
  convenio: { id: number; nome: string; cnpj: string };
  total: number;
  pacientes: Paciente[];
}> {
  return data(api.get(`/pacientes/convenio/${convenioId}`));
}


// ============================================
// Relatórios
// ============================================

/**
 * Relatório resumo geral
 */
export async function getRelatorioResumo(periodo?: string): Promise<RelatorioResumo> {
  return data(api.get('/pacientes/relatorios/resumo', { params: { periodo } }));
}

/**
 * Consultas por mês (histórico)
 */
export async function getConsultasPorMes(meses = 12): Promise<{
  periodo_meses: number;
  dados: ConsultasPorMes[];
}> {
  return data(api.get('/pacientes/relatorios/consultas-por-mes', { params: { meses } }));
}

/**
 * Ranking de pacientes por empresa
 */
export async function getPacientesPorEmpresa(limite = 10): Promise<{
  total_vinculados_empresas: number;
  empresas: PacientesPorEmpresa[];
}> {
  return data(api.get('/pacientes/relatorios/por-empresa', { params: { limite } }));
}

/**
 * Ranking de pacientes por convênio
 */
export async function getPacientesPorConvenio(limite = 10): Promise<{
  total_vinculados_convenios: number;
  convenios: PacientesPorConvenio[];
}> {
  return data(api.get('/pacientes/relatorios/por-convenio', { params: { limite } }));
}

/**
 * Distribuição geográfica de pacientes
 */
export async function getDistribuicaoGeografica(
  tipo: 'uf' | 'cidade' = 'uf',
  limite = 10
): Promise<{
  tipo: string;
  total_com_endereco: number;
  dados: DistribuicaoGeograficaUF[] | DistribuicaoGeograficaCidade[];
}> {
  return data(api.get('/pacientes/relatorios/distribuicao-geografica', { params: { tipo, limite } }));
}

/**
 * Relatório do programa de fidelidade
 */
export async function getRelatorioFidelidade(): Promise<RelatorioFidelidade> {
  return data(api.get('/pacientes/relatorios/fidelidade'));
}

/**
 * Lista aniversariantes
 */
export async function getAniversariantes(params?: {
  mes?: number;
  dias?: number;
}): Promise<{
  tipo: string;
  mes?: number;
  nome_mes?: string;
  dias?: number;
  total: number;
  aniversariantes: Aniversariante[];
}> {
  return data(api.get('/pacientes/relatorios/aniversariantes', { params }));
}

/**
 * Lista pacientes inativos (para recall)
 */
export async function getPacientesInativos(params?: {
  dias?: number;
  limite?: number;
}): Promise<{
  dias_corte: number;
  total: number;
  pacientes: PacienteInativo[];
}> {
  return data(api.get('/pacientes/relatorios/inativos', { params }));
}


// ============================================
// Export default com todos os métodos
// ============================================
export const pacientesApi = {
  // CRUD
  getAll: getPacientes,
  getById: getPacienteById,
  getByCpf: getPacienteByCpf,
  create: createPaciente,
  update: updatePaciente,
  delete: deletePaciente,
  
  // Stats & Frequência
  getStats: getPacientesStats,
  getFrequencia: getPacienteFrequencia,
  getFrequentes: getPacientesFrequentes,
  
  // Prontuário & Ficha
  getProntuario,
  downloadFichaPdf,
  downloadProntuarioPdf,
  
  // Autocomplete
  autocomplete: autocompletePacientes,
  
  // Por vínculo
  getByEmpresa: getPacientesByEmpresa,
  getByConvenio: getPacientesByConvenio,
  
  // Relatórios
  relatorios: {
    getResumo: getRelatorioResumo,
    getConsultasPorMes,
    getPorEmpresa: getPacientesPorEmpresa,
    getPorConvenio: getPacientesPorConvenio,
    getDistribuicaoGeografica,
    getFidelidade: getRelatorioFidelidade,
    getAniversariantes,
    getInativos: getPacientesInativos,
  },
};

export default pacientesApi;