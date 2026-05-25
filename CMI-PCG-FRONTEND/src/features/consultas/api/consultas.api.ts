/**
 * API Service para Consultas
 */

import api from '../../../services/api';
import type {
  Consulta,
  ConsultaResumo,
  ConsultaFormData,
  ConsultaFilters,
  ConsultaStats,
  ConsultaPorTipo,
  ConsultaPorPeriodo,
  ConsultaPorMedico,
  PacienteFrequente,
  ResumoMensal,
  MedicoOption,
  ProcedimentoOption,
} from '@/features/consultas/types/consultas.types';

const data = <T>(promise: Promise<{ data: T }>) => promise.then((r) => r.data);

// =============================================================================
// Consultas CRUD
// =============================================================================
export const consultasAPI = {
  /**
   * Lista consultas com filtros
   */
  list: async (filters?: ConsultaFilters): Promise<Consulta[] | ConsultaResumo[]> => {
    const params: Record<string, unknown> = {};

    if (filters?.search) params.search = filters.search;
    if (filters?.cpf_paciente) params.cpf_paciente = filters.cpf_paciente;
    if (filters?.crm_medico) params.crm_medico = filters.crm_medico;
    if (filters?.tipo) params.tipo = filters.tipo;
    if (filters?.data) params.data = filters.data;
    if (filters?.data_inicio) params.data_inicio = filters.data_inicio;
    if (filters?.data_fim) params.data_fim = filters.data_fim;

    if (filters?.houve_exame !== undefined && filters.houve_exame !== '') {
      params.houve_exame = filters.houve_exame;
    }
    if (filters?.houve_prescricao !== undefined && filters.houve_prescricao !== '') {
      params.houve_prescricao = filters.houve_prescricao;
    }

    if (filters?.order) params.order = filters.order;
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.offset) params.offset = filters.offset;
    if (filters?.resumo) params.resumo = 'true';

    return data(api.get('/consultas', { params }));
  },

  /**
   * Busca consulta por ID
   */
  getById: async (id: number): Promise<Consulta> => {
    return data(api.get(`/consultas/${id}`));
  },

  /**
   * Cria nova consulta
   *
   * Backend retorna: { message, consulta }
   */
  create: async (
    payload: ConsultaFormData
  ): Promise<{ message: string; consulta: Consulta }> => {
    return data(api.post('/consultas', payload));
  },

  /**
   * Atualiza consulta
   *
   * Backend retorna: { message, consulta }
   */
  update: async (
    id: number,
    payload: Partial<ConsultaFormData>
  ): Promise<{ message: string; consulta: Consulta }> => {
    return data(api.put(`/consultas/${id}`, payload));
  },

  /**
   * Remove consulta
   */
  delete: async (id: number): Promise<{ message: string }> => {
    return data(api.delete(`/consultas/${id}`));
  },

  /**
   * Lista tipos de consulta (procedimentos)
   */
  getTipos: async (): Promise<string[]> => {
    return data(api.get('/consultas/tipos'));
  },

  /**
   * Estatísticas gerais
   */
  getStats: async (params?: {
    data_inicio?: string;
    data_fim?: string;
  }): Promise<ConsultaStats> => {
    return data(api.get('/consultas/stats', { params }));
  },
};

// =============================================================================
// Relatórios
// =============================================================================
export const consultasRelatoriosAPI = {
  /**
   * Consultas por tipo
   */
  porTipo: async (params?: {
    data_inicio?: string;
    data_fim?: string;
    limite?: number;
  }): Promise<ConsultaPorTipo[]> => {
    return data(api.get('/relatorios/consultas/por-tipo', { params }));
  },

  /**
   * Consultas por período
   */
  porPeriodo: async (params: {
    data_inicio: string;
    data_fim: string;
    agrupar?: 'dia' | 'semana' | 'mes';
  }): Promise<ConsultaPorPeriodo[]> => {
    return data(api.get('/relatorios/consultas/por-periodo', { params }));
  },

  /**
   * Consultas por médico
   */
  porMedico: async (params?: {
    data_inicio?: string;
    data_fim?: string;
    limite?: number;
  }): Promise<ConsultaPorMedico[]> => {
    return data(api.get('/relatorios/consultas/por-medico', { params }));
  },

  /**
   * Pacientes mais frequentes
   */
  pacientesFrequentes: async (params?: {
    data_inicio?: string;
    data_fim?: string;
    limite?: number;
    min_consultas?: number;
  }): Promise<PacienteFrequente[]> => {
    return data(api.get('/relatorios/pacientes-frequentes', { params }));
  },

  /**
   * Resumo mensal
   */
  resumoMensal: async (ano?: number): Promise<ResumoMensal> => {
    const params = ano ? { ano } : {};
    return data(api.get('/relatorios/consultas/resumo-mensal', { params }));
  },
};

// =============================================================================
// Helpers (dependências)
// =============================================================================
export const consultasDepsAPI = {
  /**
   * Lista médicos para select
   */
  getMedicos: async (): Promise<MedicoOption[]> => {
    return data(api.get('/medicos'));
  },

  /**
   * Lista procedimentos/tipos para select
   */
  getProcedimentos: async (): Promise<ProcedimentoOption[]> => {
    return data(api.get('/procedimentos'));
  },
};

export default {
  consultas: consultasAPI,
  relatorios: consultasRelatoriosAPI,
  deps: consultasDepsAPI,
};
