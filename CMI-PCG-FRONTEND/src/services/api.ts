import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  Paciente,
  Agendamento,
  Consulta,
  Medico,
  Empresa,
  Convenio,
  Pagamento,
  DashboardStats,
  RelatorioFiltros,
  ResumoMensalPagamentos,
  ProntuarioResponse,
  AuthResponse,
  LoginCredentials,
} from '@/types';
import { tokenService } from '@/services/token.service';

// Em desenvolvimento (npm run dev): usa localhost:5000 direto
// Em produção (Docker): usa /api que o nginx faz proxy para o backend
const getBaseURL = () => {
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_API_URL || 'http://localhost:5000';
  }
  return '/api';
};

export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
});

// -----------------------------
// AUTH: request interceptor
// -----------------------------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  tokenService.migrateFromLegacyStorage();

  const token = tokenService.getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// -----------------------------
// AUTH: response interceptor (refresh)
// -----------------------------
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else if (token) prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const url = originalRequest.url ?? '';
    const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/refresh');
    if (isAuthRoute) return Promise.reject(error);

    const refreshToken = tokenService.getRefreshToken();
    if (!refreshToken) {
      tokenService.clearAll();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject: (err: Error) => reject(err),
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const resp = await axios.post<{ access_token: string }>(
        `${getBaseURL()}/auth/refresh`,
        {},
        { headers: { Authorization: `Bearer ${refreshToken}` } }
      );

      const newAccess = resp.data.access_token;
      tokenService.setAccessToken(newAccess);

      processQueue(null, newAccess);

      if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as Error, null);
      tokenService.clearAll();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

// ============================================
// Auth API (LEGACY-ONLY)
// ============================================
export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },
  logout: async (): Promise<void> => {
    try {
      await api.delete('/auth/logout');
    } finally {
      tokenService.clearAll();
    }
  },
};

// ============================================
// Dashboard API
// ============================================
export const dashboardAPI = {
  getStats: async (): Promise<DashboardStats> => data(api.get('/dashboard/stats')),

  getAgendamentosHoje: async (): Promise<Agendamento[]> => {
    const hoje = new Date().toISOString().split('T')[0];
    return data(api.get('/agendamentos', { params: { dia: hoje } }));
  },

  getAgendamentosAmanha: async (): Promise<Agendamento[]> => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dia = amanha.toISOString().split('T')[0];
    return data(api.get('/agendamentos', { params: { dia } }));
  },
};

// ============================================
// Pacientes API
// ============================================
export const pacientesAPI = {
  getAll: async (params?: {
    search?: string;
    cpf?: string;
    nome?: string;
    sexo?: 'M' | 'F';
    vinculado_a_empresa?: boolean;
    vinculado_a_convenio?: boolean;
    cnpj_empresa?: string;
    cnpj_convenio?: string;
    limit?: number;
    offset?: number;
  }): Promise<Paciente[]> => data(api.get('/pacientes', { params })),

  getById: async (id: number): Promise<Paciente> => data(api.get(`/pacientes/${id}`)),
  getByCpf: async (cpf: string): Promise<Paciente> => data(api.get(`/pacientes/cpf/${cpf}`)),

  create: async (payload: Partial<Paciente>): Promise<Paciente> => {
    const res = await api.post('/pacientes', payload);
    return res.data?.paciente ?? res.data;
  },

  update: async (id: number, payload: Partial<Paciente>): Promise<Paciente> => {
    const res = await api.put(`/pacientes/${id}`, payload);
    return res.data?.paciente ?? res.data;
  },

  delete: async (id: number): Promise<{ message: string }> => data(api.delete(`/pacientes/${id}`)),

  stats: async (): Promise<{
    total: number;
    vinculados_empresa: number;
    vinculados_convenio: number;
    particulares: number;
    por_sexo?: { masculino: number; feminino: number };
    top_empresas: { nome: string; total: number }[];
  }> => data(api.get('/pacientes/stats')),

  getCount: async (): Promise<number> => {
    const res = await api.get('/pacientes/count');
    return res.data?.count ?? res.data;
  },

  getProntuario: async (cpf: string): Promise<ProntuarioResponse> =>
    data(api.get('/prontuarios', { params: { cpf } })),

  downloadFichaPdf: async (id: number): Promise<Blob> => {
    const res = await api.get(`/pacientes/${id}/ficha/pdf`, { responseType: 'blob' });
    return res.data;
  },

  /**
   * Gera PDF do prontuário via novo endpoint /prontuarios/pdf
   *
   * @param cpf - CPF do paciente (11 dígitos, apenas números)
   * @param filters - Filtros opcionais para restringir consultas no PDF
   */
  downloadProntuarioPdf: async (
    cpf: string,
    filters?: {
      data_inicio?: string;
      data_fim?: string;
      tipo?: string;
      crm_medico?: string;
      busca?: string;
    }
  ): Promise<Blob> => {
    const params: Record<string, string> = { cpf, download: 'true' };

    if (filters?.data_inicio) params.data_inicio = filters.data_inicio;
    if (filters?.data_fim) params.data_fim = filters.data_fim;
    if (filters?.tipo) params.tipo = filters.tipo;
    if (filters?.crm_medico) params.crm_medico = filters.crm_medico;
    if (filters?.busca) params.busca = filters.busca;

    const res = await api.get('/prontuarios/pdf', {
      params,
      responseType: 'blob',
      timeout: 30000, // PDF pode demorar mais para pacientes com muitas consultas
    });
    return res.data;
  },
};

// ============================================
// Agendamentos API
// ============================================
export const agendamentosAPI = {
  getAll: async (params?: {
    dia?: string;
    nome_paciente?: string;
    cpf_paciente?: string;
    status?: string;
    paciente_compareceu?: boolean;
    procedimento?: string;
  }): Promise<Agendamento[]> => data(api.get('/agendamentos', { params })),

  getById: async (id: number): Promise<Agendamento> => data(api.get(`/agendamentos/${id}`)),

  create: async (payload: Partial<Agendamento>): Promise<Agendamento> =>
    data(api.post('/agendamentos', payload)),

  update: async (id: number, payload: Partial<Agendamento>): Promise<Agendamento> =>
    data(api.put(`/agendamentos/${id}`, payload)),

  delete: async (id: number): Promise<void> => {
    await api.delete(`/agendamentos/${id}`);
  },

  getByData: async (dia: string): Promise<Agendamento[]> =>
    data(api.get('/agendamentos', { params: { dia } })),

  importCsv: async (file: File): Promise<{
    message: string;
    created: number;
    updated: number;
    skipped: number;
    errors: { line: number; error: string }[];
  }> => {
    const form = new FormData();
    form.append('file', file);

    const res = await api.post('/agendamentos/importar?mode=upsert', form, {
      timeout: 60000,
    });

    return res.data;
  },
};

// ============================================
// Consultas API
// ============================================
export const consultasAPI = {
  getAll: async (params?: {
    cpf_paciente?: string | number;
    crm_medico?: string | number;
    tipo?: string;
    data?: string;
  }): Promise<any[]> => data(api.get('/consultas', { params })),

  getById: async (id: number): Promise<Consulta> => data(api.get(`/consultas/${id}`)),
  create: async (payload: any) => data(api.post('/consultas', payload)),
  update: async (id: number, payload: any) => data(api.put(`/consultas/${id}`, payload)),
  delete: async (id: number) => data(api.delete(`/consultas/${id}`)),
};

// ============================================
// Procedimentos API
// ============================================
export const procedimentosAPI = {
  getAll: async (): Promise<{ id: number; nome: string }[]> => data(api.get('/procedimentos')),
};

// ============================================
// Médicos API
// ============================================
export const medicosAPI = {
  getAll: async (params?: { especialidade?: string; nome?: string; cpf?: string; crm?: string }): Promise<Medico[]> =>
    data(api.get('/medicos', { params })),

  getById: async (id: number): Promise<Medico> => data(api.get(`/medicos/${id}`)),
  getByCrm: async (crm: string): Promise<Medico> => data(api.get(`/medicos/crm/${crm}`)),

  create: async (payload: Partial<Medico>): Promise<Medico> => data(api.post('/medicos', payload)),
  update: async (id: number, payload: Partial<Medico>): Promise<Medico> =>
    data(api.put(`/medicos/${id}`, payload)),
};

// ============================================
// Empresas API
// ============================================
export const empresasAPI = {
  getAll: async (): Promise<Empresa[]> => data(api.get('/empresas')),
  getById: async (id: number): Promise<Empresa> => data(api.get(`/empresas/${id}`)),
  create: async (payload: Partial<Empresa>): Promise<Empresa> => data(api.post('/empresas', payload)),
  update: async (id: number, payload: Partial<Empresa>): Promise<Empresa> =>
    data(api.put(`/empresas/${id}`, payload)),
};

// ============================================
// Convênios API
// ============================================
export const conveniosAPI = {
  getAll: async (): Promise<Convenio[]> => data(api.get('/convenios')),
  getById: async (id: number): Promise<Convenio> => data(api.get(`/convenios/${id}`)),
  create: async (payload: Partial<Convenio>): Promise<Convenio> => data(api.post('/convenios', payload)),
};

// ============================================
// Pagamentos API
// ============================================
export const pagamentosAPI = {
  getAll: async (params?: {
    search?: string;
    cpf?: string;
    empresa_id?: number | string;
    convenio_id?: number | string;
    origem?: string;
    tipo?: string;
    data?: string;
    data_inicio?: string;
    data_fim?: string;
    possui_desconto?: boolean;
    sem_vinculo?: boolean;
    limit?: number;
    offset?: number;
    order?: 'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc';
  }): Promise<Pagamento[]> => data(api.get('/pagamentos', { params })),

  getById: async (id: number): Promise<Pagamento> => data(api.get(`/pagamentos/${id}`)),

  create: async (payload: Partial<Pagamento>): Promise<Pagamento> => {
    const res = await api.post('/pagamentos', payload);
    return res.data?.pagamento ?? res.data;
  },

  update: async (id: number, payload: Partial<Pagamento>): Promise<Pagamento> => {
    const res = await api.put(`/pagamentos/${id}`, payload);
    return res.data?.pagamento ?? res.data;
  },

  delete: async (id: number): Promise<{ message: string }> => data(api.delete(`/pagamentos/${id}`)),
  stats: async (params: { data_inicio: string; data_fim: string }) => data(api.get('/pagamentos/stats', { params })),

  getResumoMensal: async (mes: number, ano: number): Promise<ResumoMensalPagamentos> => {
    const response = await api.get<ResumoMensalPagamentos>('/pagamentos/resumo', { params: { mes, ano } });
    return response.data;
  },

  downloadNotaFiscal: async (id: number): Promise<Blob> => {
    const res = await api.get(`/pagamentos/${id}/nota_fiscal`, { responseType: 'blob' });
    return res.data;
  },
};

// ============================================
// Exames API
// ============================================
export const examesAPI = {
  getAll: async () => data(api.get('/exames')),
  getTipos: async () => data(api.get('/exames/tipos')),
};

// ============================================
// Relatórios API
// ============================================
export const relatoriosAPI = {
  financeiro: async (filtros: RelatorioFiltros) => {
    const response = await api.get('/relatorio_financeiro', { params: filtros, responseType: 'blob' });
    return response.data;
  },

  aso: async (payload: any) => {
    const response = await api.post('/gerar_aso', payload, { responseType: 'blob' });
    return response.data;
  },

  solicitacaoExames: async (payload: any) => {
    const response = await api.post('/gerar_solicitacao_exames', payload, { responseType: 'blob' });
    return response.data;
  },

  pacientesMaisFrequentes: async (limite: number = 10) =>
    data(api.get('/relatorios/pacientes-frequentes', { params: { limite } })),

  consultasPorPeriodo: async (dataInicio: string, dataFim: string) =>
    data(api.get('/relatorios/consultas-periodo', { params: { data_inicio: dataInicio, data_fim: dataFim } })),

  faturamentoPorMes: async (ano: number) =>
    data(api.get('/relatorios/faturamento-mensal', { params: { ano } })),
};

// ============================================
// CEP API
// ============================================
export const cepAPI = {
  lookup: async (cep: string): Promise<{
    cep: string;
    logradouro: string;
    bairro: string;
    cidade: string;
    uf: string;
    complemento?: string;
    fonte?: string;
  }> => data(api.get(`/cep/${cep}`)),
};

export default api;