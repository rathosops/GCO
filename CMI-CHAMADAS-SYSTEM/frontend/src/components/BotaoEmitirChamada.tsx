/**
 * Botão Emitir Chamada
 * 
 * Quando clicado, envia requisição para backend que:
 * 1. Valida se chamada está em status CHAMANDO
 * 2. Envia evento WebSocket para painéis
 * 3. Painel toca som de rechamada
 * 
 * O som é tocado NO PAINEL, não localmente.
 */

import { useState, useCallback } from 'react';
import { api } from '../services/api';

interface BotaoEmitirChamadaProps {
  chamadaId: number;
  disabled?: boolean;
  className?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function BotaoEmitirChamada({
  chamadaId,
  disabled = false,
  className = '',
  onSuccess,
  onError,
}: BotaoEmitirChamadaProps) {
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading || cooldown || disabled) return;

    setLoading(true);

    try {
      await api.emitirChamadaSom(chamadaId);
      
      // Cooldown de 3 segundos para evitar spam
      setCooldown(true);
      setTimeout(() => setCooldown(false), 3000);
      
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao emitir chamada';
      console.error('[EmitirChamada]', message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  }, [chamadaId, loading, cooldown, disabled, onSuccess, onError]);

  const isDisabled = disabled || loading || cooldown;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2
        px-4 py-2 rounded-lg font-medium
        transition-all duration-200
        ${isDisabled
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl active:scale-95'
        }
        ${className}
      `}
      title={cooldown ? 'Aguarde...' : 'Emitir som no painel'}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Emitindo...
        </>
      ) : cooldown ? (
        <>
          <span>⏳</span>
          Aguarde...
        </>
      ) : (
        <>
          <span>🔊</span>
          Emitir Chamada
        </>
      )}
    </button>
  );
}

export default BotaoEmitirChamada;
