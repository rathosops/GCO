/**
 * Tipos do sistema CMI Chamadas - Versão 5.2 (SFX Only)
 * 
 * Removidos: tipos de música de fundo
 */

// ===== Usuário =====

export interface Usuario {
  id: number;
  username: string;
  nome: string;
  tipo: 'MEDICO' | 'TRIAGEM' | 'ADMIN' | 'DEV';
  sala: string | null;
  ativo: boolean;
}

// ===== Agendamento =====

export interface Agendamento {
  id: number;
  dia: string;
  hora: string;
  cpf_paciente: number | null;
  nome_paciente: string;
  procedimento: string | null;
  numero_de_contato: number | null;
  status: string;
  observacoes: string | null;
  paciente_compareceu: boolean | null;
  is_imesc: boolean;
  triagem_id: number | null;
  triagem_concluida: boolean | null;
  chamada_ativa_id: number | null;
  chamada_status: string | null;
  pode_chamar?: boolean;
}

// ===== Chamada =====

export interface Chamada {
  id: number;
  agendamento_id: number;
  sala: string;
  tipo: string;
  chamado_por_id: number | null;
  chamado_por_nome: string;
  status: string;
  chamado_em: string | null;
  atendido_em: string | null;
  finalizado_em: string | null;
  observacoes: string | null;
  nome_paciente?: string;
}

/** Chamada para painel - payload completo da API */
export interface ChamadaPainel {
  id: number;
  agendamento_id?: number;
  nome_paciente: string;
  sala: string;
  tipo: string;
  chamado_por_nome: string;
  status: string;
  chamado_em: string | null;
  medico_nome?: string | null;
  medico_especialidade?: string | null;
}

/** Chamada compacta do WebSocket (payload otimizado) */
export interface ChamadaCompacta {
  id: number;
  nome: string;
  sala: string;
  status: string;
}

/** Histórico de chamadas */
export interface HistoricoChamada {
  id: number;
  agendamento_id: number;
  nome_paciente: string;
  sala: string;
  tipo: string;
  chamado_por_nome: string;
  status: string;
  chamado_em: string | null;
  atendido_em: string | null;
  finalizado_em: string | null;
}

// ===== Triagem =====

export interface Triagem {
  id: number;
  agendamento_id: number;
  triagem_concluida: boolean;
  triagem_em: string | null;
  realizada_por_id: number | null;
  observacoes: string | null;
}

export interface TriagemPendente {
  id: number;
  nome_paciente: string;
  cpf_paciente: number | null;
  hora: string;
  procedimento: string;
  status: string;
  triagem_id: number | null;
  triagem_iniciada: boolean;
  triagem_concluida: boolean;
  chamada_id: number | null;
  chamada_status: string | null;
}

export interface TriagemConcluida {
  id: number;
  agendamento_id: number;
  nome_paciente: string;
  procedimento: string;
  triagem_em: string;
  realizada_por: string;
  observacoes: string | null;
}

// ===== WebSocket =====

/** Mensagem WebSocket (formato antigo - compatibilidade) */
export interface WebSocketMessage {
  event: string;
  data: unknown;
  timestamp?: string;
  /** Evento compacto original */
  e?: string;
  /** Dados compactos */
  d?: unknown;
  /** Timestamp unix */
  t?: number;
}

/** Dados de chamada no WebSocket compacto */
export interface WSChamadaData {
  chamadas?: ChamadaCompacta[];
  nova?: { id: number };
}

/** Dados de triagem no WebSocket compacto */
export interface WSTriagemData {
  ag_id?: number;
  msg?: string;
}

// ===== Auth =====

export interface LoginResponse {
  access_token: string;
  token_type: string;
  usuario: Usuario;
}

export interface ApiError {
  detail: string;
}

// ===== Dev =====

export interface DevWebSocketClient {
  id: string;
  type: string;
}

export interface DevWebSocketStats {
  total_connections: number;
  by_type: Record<string, number>;
  clients: DevWebSocketClient[];
}

export interface DevStats {
  websocket: DevWebSocketStats;
}
