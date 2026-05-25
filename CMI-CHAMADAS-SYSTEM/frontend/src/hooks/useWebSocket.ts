/**
 * Hook WebSocket otimizado para TV Samsung.
 *
 * Otimizações:
 * - Protocolo compacto (e/d/t)
 * - Reconexão com backoff exponencial
 * - Debounce em mensagens consecutivas
 * - Cleanup agressivo
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || '/ws';

// Eventos do backend (compactos)
export const WS_EVENTS = {
  CHAMADA: 'C',       // Nova chamada → som 3x
  EMITIR_SOM: 'S',    // Rechamada → som diferente 1x
  ATUALIZA: 'U',      // Atualização → sem som
  TRIAGEM: 'T',
  HEARTBEAT: 'H',
  CONECTADO: 'OK',
  ERRO: 'E',
} as const;

// Mapeia eventos compactos para nomes legíveis (compatibilidade)
const EVENT_MAP: Record<string, string> = {
  C: 'NOVA_CHAMADA',
  S: 'EMITIR_SOM',
  U: 'CHAMADA_ATUALIZADA',
  T: 'TRIAGEM_CONCLUIDA',
  H: 'HEARTBEAT',
  OK: 'CONECTADO',
  E: 'ERRO',
};

export interface WSMessage {
  /** Evento compacto do backend */
  e: string;
  /** Dados */
  d: unknown;
  /** Timestamp unix */
  t: number;
  /** Evento normalizado para compatibilidade */
  event: string;
  /** Alias para d */
  data: unknown;
}

type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketOptions {
  onMessage?: (message: WSMessage) => void;
  autoReconnect?: boolean;
  /** Intervalo base de reconexão (ms) */
  reconnectInterval?: number;
  /** Máximo de tentativas */
  maxRetries?: number;
}

export function useWebSocket(
  endpoint: string,
  options: UseWebSocketOptions = {}
) {
  const {
    onMessage,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxRetries = 10,
  } = options;

  const [status, setStatus] = useState<WSStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);
  const onMessageRef = useRef(onMessage);

  // Mantém referência atualizada
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mountedRef.current) {
      setStatus('disconnected');
    }
  }, [cleanup]);

  const connect = useCallback(() => {
    // Evita conexões duplicadas
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    cleanup();
    if (mountedRef.current) setStatus('connecting');

    try {
      // Monta URL corretamente
      const wsUrl = WS_URL.startsWith('ws')
        ? `${WS_URL}${endpoint}`
        : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${WS_URL}${endpoint}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0;
        if (mountedRef.current) setStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);

          // Normaliza mensagem compacta
          const message: WSMessage = {
            e: raw.e || raw.event || '',
            d: raw.d ?? raw.data ?? {},
            t: raw.t || Date.now() / 1000,
            // Compatibilidade com código antigo
            event: EVENT_MAP[raw.e] || raw.event || raw.e || '',
            data: raw.d ?? raw.data ?? {},
          };

          // Ignora heartbeats para não causar re-render
          if (message.e === WS_EVENTS.HEARTBEAT) return;

          if (mountedRef.current) {
            setLastMessage(message);
          }
          onMessageRef.current?.(message);
        } catch {
          // Ignora mensagens inválidas
        }
      };

      ws.onerror = () => {
        if (mountedRef.current) setStatus('error');
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (mountedRef.current) setStatus('disconnected');

        // Reconexão com backoff exponencial
        if (autoReconnect && mountedRef.current && retriesRef.current < maxRetries) {
          const delay = Math.min(
            reconnectInterval * Math.pow(1.5, retriesRef.current),
            30000
          );
          retriesRef.current++;

          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (mountedRef.current) connect();
          }, delay);
        }
      };
    } catch {
      if (mountedRef.current) setStatus('error');
    }
  }, [endpoint, autoReconnect, reconnectInterval, maxRetries, cleanup]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [endpoint]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    lastMessage,
    send,
    connect,
    disconnect,
    isConnected: status === 'connected',
  };
}
