/**
 * Painel TV - Versão otimizada para Samsung Tizen
 * 
 * Apenas efeitos sonoros (SFX), sem música de fundo.
 * - chamada_sfx.mp3: som de nova chamada (toca 3x)
 * - Evento WebSocket "C" (CHAMADA) ou "EMITIR_SOM" aciona o som
 */

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useWebSocket, WS_EVENTS } from '../hooks/useWebSocket';
import type { WSMessage } from '../hooks/useWebSocket';
import { api } from '../services/api';
import { playChamadaPainel, preloadSounds } from '../utils/sound';
import {
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Phone,
  RefreshCw,
  History,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import type { ChamadaPainel, ChamadaCompacta } from '../types';

interface HistoricoChamada {
  id: number;
  nome_paciente: string;
  sala: string;
  status: string;
  chamado_em: string | null;
}

const POLLING_INTERVAL = 30000;
const DEBOUNCE_MS = 300;

const formatTime = (date: Date) =>
  date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const formatDate = (date: Date) =>
  date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

const formatHora = (iso: string | null) => {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

interface ChamadaCardProps {
  chamada: ChamadaPainel | ChamadaCompacta;
  isFirst: boolean;
}

const ChamadaCard = memo(function ChamadaCard({ chamada, isFirst }: ChamadaCardProps) {
  const nome = 'nome_paciente' in chamada ? chamada.nome_paciente : chamada.nome;
  const isChamando = chamada.status === 'CHAMANDO';

  return (
    <div
      className={`p-6 rounded-2xl border transition-opacity duration-300
        ${isFirst && isChamando ? 'bg-orange-900/30 border-orange-500/50'
          : isFirst ? 'bg-blue-900/20 border-blue-500/40'
          : 'bg-white/5 border-white/10'}`}
      style={{ transform: isFirst ? 'scale(1.01)' : 'scale(1)', willChange: isFirst ? 'transform' : 'auto' }}
    >
      <div className="flex items-center gap-6">
        <div className={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center
          ${isFirst ? 'bg-gradient-to-br from-orange-500 to-orange-600' : 'bg-white/10'}`}>
          <Phone className={isFirst ? 'w-8 h-8 text-white' : 'w-7 h-7 text-orange-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className={`font-bold truncate ${isFirst ? 'text-4xl' : 'text-2xl'}`}>{nome || 'Paciente'}</h2>
          <div className={`flex items-center gap-3 mt-2 ${isFirst ? 'text-lg' : 'text-base'}`}>
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300">Consulta</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`font-bold text-orange-400 ${isFirst ? 'text-4xl' : 'text-2xl'}`}>{chamada.sala}</p>
        </div>
      </div>
      {isFirst && (
        <div className="mt-6 pt-6 border-t border-white/10 flex justify-center">
          <span className={`inline-flex items-center gap-2 px-8 py-3 rounded-full text-xl font-bold
            ${isChamando ? 'bg-gradient-to-r from-orange-500 to-orange-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'}`}>
            <span className="w-3 h-3 bg-white rounded-full" />
            {isChamando ? 'CHAMANDO' : 'EM ATENDIMENTO'}
          </span>
        </div>
      )}
    </div>
  );
});

const HistoricoItem = memo(function HistoricoItem({ item }: { item: HistoricoChamada }) {
  const StatusIcon = item.status === 'FINALIZADO' ? CheckCircle : item.status === 'NAO_COMPARECEU' ? XCircle : Clock;
  const statusColor = item.status === 'FINALIZADO' ? 'text-emerald-400' : item.status === 'NAO_COMPARECEU' ? 'text-red-400' : 'text-gray-400';
  const statusText = item.status === 'FINALIZADO' ? 'Atendido' : item.status === 'NAO_COMPARECEU' ? 'Não compareceu' : item.status === 'CANCELADO' ? 'Cancelado' : item.status;

  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">{item.nome_paciente}</p>
          <div className="flex items-center gap-2 mt-1 text-sm text-white/50">
            <span>{item.sala}</span><span>•</span><span>{formatHora(item.chamado_em)}</span>
          </div>
        </div>
        <div className={`flex items-center gap-1 ${statusColor}`}>
          <StatusIcon className="w-4 h-4" /><span className="text-xs">{statusText}</span>
        </div>
      </div>
    </div>
  );
});

export function PainelPage() {
  const [chamadas, setChamadas] = useState<ChamadaPainel[]>([]);
  const [historico, setHistorico] = useState<HistoricoChamada[]>([]);
  const [showHistorico, setShowHistorico] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  // Pré-carrega os sons na inicialização
  useEffect(() => {
    preloadSounds();
  }, []);

  const carregarChamadas = useCallback(async () => {
    try {
      const data = await api.getChamadasPainel() as ChamadaPainel[];
      setChamadas(data);
    } catch (err) {
      console.error('Erro ao carregar chamadas:', err);
    }
  }, []);

  const carregarHistorico = useCallback(async () => {
    try {
      const data = await api.getHistoricoHoje(10) as HistoricoChamada[];
      setHistorico(data);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    }
  }, []);

  useEffect(() => {
    carregarChamadas();
    carregarHistorico();
    const interval = setInterval(() => {
      carregarChamadas();
      carregarHistorico();
    }, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [carregarChamadas, carregarHistorico]);

  // Toca som de chamada (3x) quando áudio está habilitado
  const tocarSomChamada = useCallback(() => {
    if (audioEnabled) {
      playChamadaPainel();
    }
  }, [audioEnabled]);

  // Handler de mensagens WebSocket
  const handleWSMessage = useCallback((message: WSMessage) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    
    debounceTimerRef.current = window.setTimeout(() => {
      const event = message.e || message.event;
      
      // Som 3x: eventos CHAMADA (C) ou EMITIR_SOM = paciente sendo chamado ou rechamado
      if (event === WS_EVENTS.CHAMADA || event === 'NOVA_CHAMADA' || event === 'EMITIR_SOM') {
        tocarSomChamada();
        carregarChamadas();
      }
      // Atualização sem som
      else if (event === WS_EVENTS.ATUALIZA || event === 'CHAMADA_ATUALIZADA') {
        carregarChamadas();
        carregarHistorico();
      }
      // Triagem concluída
      else if (event === WS_EVENTS.TRIAGEM || event === 'TRIAGEM_CONCLUIDA') {
        carregarChamadas();
      }
    }, DEBOUNCE_MS);
  }, [carregarChamadas, carregarHistorico, tocarSomChamada]);

  const { status: wsStatus } = useWebSocket('/ws/painel', { onMessage: handleWSMessage });

  // Atualiza relógio
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Toggle de áudio (toca som de teste quando ativa)
  const handleToggleAudio = () => {
    setAudioEnabled(prev => {
      if (!prev) {
        // Toca som de teste ao ativar (também serve para liberar autoplay)
        playChamadaPainel();
      }
      return !prev;
    });
  };

  const handleRefresh = () => {
    carregarChamadas();
    carregarHistorico();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 painel-tv">
      <header className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4 mb-2">
          <img
            src="/logo_cmi.png"
            alt="Logo CMI"
            className="h-14 w-auto object-contain"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div>
            <h1 className="text-3xl font-bold">CMI <span className="text-orange-400">Chamadas</span></h1>
            <p className="text-white/60 text-lg capitalize">{formatDate(currentTime)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Botão Histórico */}
          <button
            onClick={() => setShowHistorico(prev => !prev)}
            className={`p-3 rounded-xl transition-colors ${showHistorico ? 'bg-purple-500/30 text-purple-300' : 'bg-white/10 hover:bg-white/20'}`}
            title="Mostrar/ocultar histórico"
          >
            <History className="w-6 h-6" />
          </button>

          {/* Botão Atualizar */}
          <button
            onClick={handleRefresh}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-6 h-6" />
          </button>

          {/* Botão Som */}
          <button
            onClick={handleToggleAudio}
            className={`p-3 rounded-xl transition-all ${audioEnabled ? 'bg-gradient-to-br from-orange-500 to-orange-600' : 'bg-white/10 hover:bg-white/20'}`}
            title={audioEnabled ? 'Som ativado' : 'Som desativado'}
          >
            {audioEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>

          {/* Status WebSocket */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border ${wsStatus === 'connected' ? 'border-emerald-400/40' : 'border-red-400/40'}`}>
            {wsStatus === 'connected' ? (
              <Wifi className="w-5 h-5 text-emerald-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-400" />
            )}
          </div>

          {/* Relógio */}
          <div className="text-4xl font-mono font-bold tracking-wider">
            {formatTime(currentTime)}
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
        {/* Lista de Chamadas */}
        <div className={`${showHistorico ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
          <h2 className="text-xl font-bold text-white/80 flex items-center gap-2">
            <Phone className="w-5 h-5 text-orange-400" />
            Chamadas Ativas
            {chamadas.length > 0 && (
              <span className="ml-2 px-2 py-1 rounded-full bg-orange-500/20 text-orange-300 text-sm">
                {chamadas.length}
              </span>
            )}
          </h2>

          {chamadas.length === 0 ? (
            <div className="text-center py-20 bg-white/5 rounded-2xl">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
                <Phone className="w-12 h-12 text-white/30" />
              </div>
              <p className="text-2xl text-white/40 font-medium">Aguardando chamadas...</p>
              <p className="text-white/30 mt-2">As chamadas aparecerão automaticamente</p>
            </div>
          ) : (
            chamadas.map((chamada, index) => (
              <ChamadaCard key={chamada.id} chamada={chamada} isFirst={index === 0} />
            ))
          )}
        </div>

        {/* Histórico */}
        {showHistorico && (
          <div className="lg:col-span-1">
            <h2 className="text-xl font-bold text-white/80 flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-purple-400" />
              Histórico
              {historico.length > 0 && (
                <span className="ml-2 px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 text-sm">
                  {historico.length}
                </span>
              )}
            </h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {historico.length === 0 ? (
                <div className="text-center py-12 bg-white/5 rounded-xl">
                  <History className="w-12 h-12 mx-auto text-white/20 mb-3" />
                  <p className="text-white/40">Nenhum atendimento</p>
                </div>
              ) : (
                historico.map(item => <HistoricoItem key={item.id} item={item} />)
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-black/50 py-4 px-6 border-t border-white/10">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <img
              src="/logo_cmi.png"
              alt="CMI"
              className="h-8 w-auto object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="text-white/60">Centro Médico Integrado</span>
          </div>
          <div className="flex items-center gap-4 text-white/40 text-sm">
            <span>Som: {audioEnabled ? 'ativado' : 'desativado'}</span>
            <span>•</span>
            <span>WS: {wsStatus === 'connected' ? 'conectado' : 'desconectado'}</span>
            <span>•</span>
            <span>v5.2-sfx</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
