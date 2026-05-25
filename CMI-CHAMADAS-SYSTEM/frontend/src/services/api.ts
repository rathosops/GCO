/**
 * Serviço de API - CMI Sistema de Chamadas
 */

import type {
  Usuario,
  Agendamento,
  Chamada,
  ChamadaPainel,
  DevStats,
  TriagemPendente,
  TriagemConcluida,
} from '../types';

// VITE_API_URL deve ser '' (vazio) ou URL completa sem /api
// O Nginx faz proxy de /api/ para o backend
const API_BASE = import.meta.env.VITE_API_URL || '';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  usuario: {
    id: number;
    username: string;
    nome: string;
    tipo: string;
    sala?: string | null;
  };
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // API_BASE já é /api (do Nginx), então endpoint começa com /v1/...
  const url = `${API_BASE}/v1${endpoint}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response
      .json()
      .catch(() => ({ detail: 'Erro desconhecido' }));

    const message =
      typeof errorBody === 'string'
        ? errorBody
        : errorBody.detail || errorBody.message || `Erro HTTP ${response.status}`;

    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getToken,
  logout,

  // Auth
  async login(username: string, password: string): Promise<LoginResponse> {
    const data = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    return data;
  },

  async getMe(): Promise<Usuario> {
    return request<Usuario>('/auth/me');
  },

  // Usuários
  async listUsuarios(): Promise<Usuario[]> {
    return request<Usuario[]>('/usuarios/');
  },

  async createUsuario(payload: {
    username: string;
    nome: string;
    tipo: Usuario['tipo'];
    sala?: string | null;
    senha: string;
    ativo?: boolean;
  }): Promise<Usuario> {
    return request<Usuario>('/usuarios/', {
      method: 'POST',
      body: { ...payload, sala: payload.sala ?? null, ativo: payload.ativo ?? true },
    });
  },

  async updateUsuario(
    id: number,
    payload: { nome?: string; tipo?: Usuario['tipo']; sala?: string | null; senha?: string; ativo?: boolean },
  ): Promise<Usuario> {
    const body: Record<string, unknown> = {};
    if (typeof payload.nome === 'string') body.nome = payload.nome;
    if (typeof payload.tipo === 'string') body.tipo = payload.tipo;
    if (typeof payload.sala !== 'undefined') body.sala = payload.sala;
    if (typeof payload.ativo === 'boolean') body.ativo = payload.ativo;
    if (payload.senha?.trim()) body.senha = payload.senha;
    return request<Usuario>(`/usuarios/${id}`, { method: 'PATCH', body });
  },

  async deleteUsuario(id: number): Promise<void> {
    await request<void>(`/usuarios/${id}`, { method: 'DELETE' });
  },

  // Agendamentos
  async getAgendamentosHoje(): Promise<Agendamento[]> {
    return request<Agendamento[]>('/agendamentos/hoje');
  },

  async getAgendamentosAguardando(): Promise<Agendamento[]> {
    return request<Agendamento[]>('/agendamentos/aguardando');
  },

  async getAgendamentosConfirmados(): Promise<Agendamento[]> {
    return request<Agendamento[]>('/agendamentos/confirmados');
  },

  async getAgendamento(id: number): Promise<Agendamento> {
    return request<Agendamento>(`/agendamentos/${id}`);
  },

  async getAgendamentosTriagem(): Promise<Agendamento[]> {
    return request<Agendamento[]>('/agendamentos/triagem');
  },

  // Chamadas
  async criarChamada(agendamentoId: number, sala: string, tipo: string, observacoes?: string): Promise<Chamada> {
    return request<Chamada>('/chamadas/', {
      method: 'POST',
      body: { agendamento_id: agendamentoId, sala, tipo, observacoes },
    });
  },

  async iniciarAtendimento(chamadaId: number): Promise<Chamada> {
    return request<Chamada>('/chamadas/iniciar-atendimento', {
      method: 'POST',
      body: { chamada_id: chamadaId },
    });
  },

  async finalizarAtendimento(chamadaId: number, pacienteCompareceu: boolean, observacoes?: string): Promise<Chamada> {
    return request<Chamada>('/chamadas/finalizar-atendimento', {
      method: 'POST',
      body: { chamada_id: chamadaId, paciente_compareceu: pacienteCompareceu, observacoes },
    });
  },

  async cancelarChamada(chamadaId: number): Promise<Chamada> {
    return request<Chamada>(`/chamadas/${chamadaId}/cancelar`, { method: 'POST' });
  },

  async getChamadasPainel(): Promise<ChamadaPainel[]> {
    return request<ChamadaPainel[]>('/chamadas/painel');
  },

  async getHistoricoHoje(limite = 20): Promise<unknown[]> {
    return request<unknown[]>(`/chamadas/historico-hoje?limite=${limite}`);
  },

  async getHistorico(limite = 100): Promise<Chamada[]> {
    return request<Chamada[]>(`/chamadas/historico?limite=${limite}`);
  },

  async resetarChamadas(): Promise<{ message: string; count: number }> {
    return request<{ message: string; count: number }>('/chamadas/resetar', { method: 'POST' });
  },

  async emitirChamadaSom(chamadaId: number): Promise<{ ok: boolean; message: string }> {
    return request<{ ok: boolean; message: string }>(`/chamadas/${chamadaId}/emitir-som`, { method: 'POST' });
  },

  // Triagem
  async getTriagemPendentes(): Promise<TriagemPendente[]> {
    return request<TriagemPendente[]>('/triagem/pendentes');
  },

  async getTriagemConcluidas(): Promise<TriagemConcluida[]> {
    return request<TriagemConcluida[]>('/triagem/concluidas');
  },

  async concluirTriagem(agendamentoId: number, observacoes?: string): Promise<TriagemConcluida> {
    return request<TriagemConcluida>('/triagem/concluir', {
      method: 'POST',
      body: { agendamento_id: agendamentoId, observacoes },
    });
  },

  async verificarTriagem(agendamentoId: number): Promise<TriagemConcluida | TriagemPendente> {
    return request<TriagemConcluida | TriagemPendente>(`/triagem/verificar/${agendamentoId}`);
  },

  // Dev
  async getDevStats(): Promise<DevStats> {
    return request<DevStats>('/dev/stats');
  },

  async simularChamada(agendamentoId: number, sala: string, tipo: string): Promise<Chamada> {
    return request<Chamada>('/dev/simular-chamada', {
      method: 'POST',
      body: { agendamento_id: agendamentoId, sala, tipo },
    });
  },
};