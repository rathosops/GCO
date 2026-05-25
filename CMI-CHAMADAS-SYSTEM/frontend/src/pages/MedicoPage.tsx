/**
 * Página do Médico
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket, WS_EVENTS } from '../hooks/useWebSocket';
import type { WSMessage } from '../hooks/useWebSocket';
import { api } from '../services/api';
import {
  Phone, Check, X, RefreshCw, LogOut, User, Clock, AlertCircle,
  Loader2, CheckCircle2, XCircle, RotateCcw, Stethoscope, Bell, Volume2,
} from 'lucide-react';
import type { Agendamento, Chamada, ChamadaPainel } from '../types';
import { formatHoraIso } from '../utils/format';
import { ChamadasAtivasList } from '../components/ChamadasAtivasList';

export function MedicoPage() {
  const { usuario, logout } = useAuth();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [chamadaAtiva, setChamadaAtiva] = useState<Chamada | null>(null);
  const [chamadas, setChamadas] = useState<ChamadaPainel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [novaTriagem, setNovaTriagem] = useState(false);
  const fastPollingRef = useRef<number | null>(null);

  const buscarChamadaAtiva = useCallback(async () => {
    try {
      const chamadasApi = await api.getChamadasPainel() as ChamadaPainel[];
      setChamadas(chamadasApi);
      const minhasChamadas = chamadasApi.filter(c => c.chamado_por_nome === usuario?.nome && (c.status === 'CHAMANDO' || c.status === 'ATENDENDO'));
      if (minhasChamadas.length > 0) {
        const cp = minhasChamadas[0];
        setChamadaAtiva({ id: cp.id, agendamento_id: cp.agendamento_id || 0, sala: cp.sala, tipo: cp.tipo, chamado_por_id: usuario?.id || null, chamado_por_nome: cp.chamado_por_nome, status: cp.status, chamado_em: cp.chamado_em, atendido_em: null, finalizado_em: null, observacoes: null, nome_paciente: cp.nome_paciente });
      } else { setChamadaAtiva(null); }
    } catch (err) { console.error('Erro ao buscar chamada ativa:', err); }
  }, [usuario]);

  const carregarAgendamentos = useCallback(async () => {
    try { setAgendamentos(await api.getAgendamentosAguardando() as Agendamento[]); }
    catch (err) { console.error('Erro ao carregar agendamentos:', err); }
  }, []);

  const carregarDados = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([carregarAgendamentos(), buscarChamadaAtiva()]);
    setIsLoading(false);
  }, [carregarAgendamentos, buscarChamadaAtiva]);

  useEffect(() => {
    carregarDados();
    const interval = window.setInterval(carregarDados, 10000);
    return () => window.clearInterval(interval);
  }, [carregarDados]);

  const handleMessage = useCallback((message: WSMessage) => {
    const event = message.e || message.event;
    if (event === WS_EVENTS.TRIAGEM || event === 'TRIAGEM_CONCLUIDA') {
      setNovaTriagem(true); setTimeout(() => setNovaTriagem(false), 5000); carregarDados();
      if (fastPollingRef.current !== null) window.clearInterval(fastPollingRef.current);
      let count = 0;
      fastPollingRef.current = window.setInterval(() => { carregarDados(); count++; if (count >= 15 && fastPollingRef.current !== null) { window.clearInterval(fastPollingRef.current); fastPollingRef.current = null; } }, 2000);
    } else if (event === WS_EVENTS.ATUALIZA || event === WS_EVENTS.CHAMADA || event === 'CHAMADA_ATUALIZADA' || event === 'NOVA_CHAMADA') { carregarDados(); }
  }, [carregarDados]);

  const salaQuery = usuario?.sala ? `?sala=${encodeURIComponent(usuario.sala)}` : '';
  useWebSocket(`/ws/medico${salaQuery}`, { onMessage: handleMessage });

  useEffect(() => { return () => { if (fastPollingRef.current !== null) window.clearInterval(fastPollingRef.current); }; }, []);

  const chamarPaciente = async (agendamento: Agendamento) => {
    if (!usuario?.sala) { setError('Usuário não possui sala configurada'); return; }
    setLoadingAction(`chamar-${agendamento.id}`); setError('');
    try {
      const chamada = await api.criarChamada(agendamento.id, usuario.sala, 'MEDICO') as Chamada;
      setChamadaAtiva({ ...chamada, nome_paciente: agendamento.nome_paciente });
      setSuccess(`${agendamento.nome_paciente} foi chamado(a)!`); setTimeout(() => setSuccess(''), 3000);
      await carregarAgendamentos(); await buscarChamadaAtiva();
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao chamar paciente'); }
    finally { setLoadingAction(null); }
  };

  // Emitir chamada - envia evento para o PAINEL tocar o som
  const emitirChamada = async () => {
    if (!chamadaAtiva) return;
    setLoadingAction('emitir');
    try {
      await api.emitirChamadaSom(chamadaAtiva.id);
      setSuccess('📢 Chamada emitida no painel!'); setTimeout(() => setSuccess(''), 2000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao emitir chamada'); }
    finally { setLoadingAction(null); }
  };

  const iniciarAtendimento = async () => {
    if (!chamadaAtiva) return;
    setLoadingAction('iniciar'); setError('');
    try {
      const chamada = await api.iniciarAtendimento(chamadaAtiva.id) as Chamada;
      setChamadaAtiva(prev => prev ? { ...prev, ...chamada, nome_paciente: prev.nome_paciente } : null);
      setSuccess('Atendimento iniciado!'); setTimeout(() => setSuccess(''), 2000);
      await buscarChamadaAtiva();
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao iniciar atendimento'); }
    finally { setLoadingAction(null); }
  };

  const finalizarAtendimento = async (compareceu: boolean) => {
    if (!chamadaAtiva) return;
    setLoadingAction(compareceu ? 'finalizar' : 'naocompareceu'); setError('');
    try {
      await api.finalizarAtendimento(chamadaAtiva.id, compareceu);
      const nomePaciente = chamadaAtiva.nome_paciente; setChamadaAtiva(null);
      setSuccess(compareceu ? `Atendimento de ${nomePaciente} finalizado!` : `${nomePaciente} marcado como não compareceu`);
      setTimeout(() => setSuccess(''), 3000);
      await carregarAgendamentos(); await buscarChamadaAtiva();
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao finalizar atendimento'); }
    finally { setLoadingAction(null); }
  };

  const cancelarChamada = async () => {
    if (!chamadaAtiva) return;
    setLoadingAction('cancelar'); setError('');
    try {
      await api.cancelarChamada(chamadaAtiva.id); setChamadaAtiva(null);
      setSuccess('Chamada cancelada'); setTimeout(() => setSuccess(''), 2000);
      await carregarAgendamentos(); await buscarChamadaAtiva();
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao cancelar chamada'); }
    finally { setLoadingAction(null); }
  };

  const resetarChamadas = async () => {
    if (!confirm('Tem certeza que deseja resetar todas as chamadas ativas?')) return;
    setLoadingAction('resetar');
    try {
      await api.resetarChamadas(); setChamadaAtiva(null);
      setSuccess('Chamadas resetadas'); setTimeout(() => setSuccess(''), 2000);
      await carregarAgendamentos(); await buscarChamadaAtiva();
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao resetar'); }
    finally { setLoadingAction(null); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center"><Stethoscope className="w-5 h-5 text-white" /></div>
              <div><h1 className="text-xl font-bold text-gray-800">Painel Médico</h1><p className="text-sm text-gray-500">{usuario?.nome} • {usuario?.sala || 'Sem sala'}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={carregarDados} disabled={isLoading} className="p-2 rounded-lg hover:bg-gray-100" title="Atualizar"><RefreshCw className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} /></button>
              <button onClick={resetarChamadas} disabled={loadingAction === 'resetar'} className="p-2 rounded-lg hover:bg-orange-100 text-orange-600" title="Resetar chamadas"><RotateCcw className="w-5 h-5" /></button>
              <button onClick={logout} className="p-2 rounded-lg hover:bg-red-100 text-red-600" title="Sair"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {novaTriagem && <div className="mb-6 flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl text-purple-700"><Bell className="w-5 h-5 flex-shrink-0" /><span className="flex-1 font-medium">🎉 Paciente IMESC liberado pela triagem! Lista atualizada.</span></div>}
        {error && <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700"><AlertCircle className="w-5 h-5 flex-shrink-0" /><span className="flex-1">{error}</span><button onClick={() => setError('')} className="p-1 hover:bg-red-100 rounded"><X className="w-4 h-4" /></button></div>}
        {success && <div className="mb-6 flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700"><CheckCircle2 className="w-5 h-5 flex-shrink-0" /><span className="flex-1">{success}</span><button onClick={() => setSuccess('')} className="p-1 hover:bg-emerald-100 rounded"><X className="w-4 h-4" /></button></div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Phone className="w-5 h-5 text-blue-500" />Chamada Atual</h2>
            {chamadaAtiva ? (
              <div className="space-y-4">
                <div className={`p-5 rounded-xl ${chamadaAtiva.status === 'CHAMANDO' ? 'bg-orange-50 border-2 border-orange-200' : 'bg-blue-50 border-2 border-blue-200'}`}>
                  <p className="text-2xl font-bold text-gray-800">{chamadaAtiva.nome_paciente || 'Paciente'}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${chamadaAtiva.status === 'CHAMANDO' ? 'bg-orange-200 text-orange-800' : 'bg-blue-200 text-blue-800'}`}>{chamadaAtiva.status === 'CHAMANDO' ? '📢 Chamando' : '🩺 Em Atendimento'}</span>
                    <span className="text-sm text-gray-500">{chamadaAtiva.sala}</span>
                    <span className="text-xs text-gray-400">Início: {formatHoraIso(chamadaAtiva.chamado_em)}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {chamadaAtiva.status === 'CHAMANDO' && (
                    <>
                      <button onClick={emitirChamada} disabled={loadingAction === 'emitir'} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium disabled:opacity-50 hover:from-amber-600 hover:to-orange-600 transition-all">
                        {loadingAction === 'emitir' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}📢 Emitir Chamada (Paciente Demorando)
                      </button>
                      <button onClick={iniciarAtendimento} disabled={loadingAction === 'iniciar'} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium disabled:opacity-50">
                        {loadingAction === 'iniciar' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}Paciente Chegou - Iniciar Atendimento
                      </button>
                      <button onClick={cancelarChamada} disabled={loadingAction === 'cancelar'} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl">
                        {loadingAction === 'cancelar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}Cancelar Chamada
                      </button>
                    </>
                  )}
                  {chamadaAtiva.status === 'ATENDENDO' && (
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => finalizarAtendimento(true)} disabled={loadingAction === 'finalizar'} className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium disabled:opacity-50">
                        {loadingAction === 'finalizar' ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}Finalizar
                      </button>
                      <button onClick={() => finalizarAtendimento(false)} disabled={loadingAction === 'naocompareceu'} className="flex items-center justify-center gap-2 px-4 py-3 bg-red-100 text-red-700 rounded-xl font-medium disabled:opacity-50">
                        {loadingAction === 'naocompareceu' ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}Não Compareceu
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center"><Phone className="w-8 h-8 text-gray-300" /></div>
                <p className="text-gray-500 font-medium">Nenhuma chamada ativa</p>
                <p className="text-sm text-gray-400 mt-1">Selecione um paciente ao lado para chamar</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><User className="w-5 h-5 text-blue-500" />Pacientes Aguardando</h2>
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">{agendamentos.length} paciente(s)</span>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {agendamentos.length === 0 ? (
                <div className="text-center py-12"><div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center"><User className="w-8 h-8 text-gray-300" /></div><p className="text-gray-500">Nenhum paciente aguardando</p></div>
              ) : agendamentos.map((agendamento) => {
                const podeCharmar = agendamento.pode_chamar !== false && !chamadaAtiva;
                const aguardandoTriagem = agendamento.is_imesc && !agendamento.triagem_concluida;
                return (
                  <div key={agendamento.id} className={`p-4 border-2 rounded-xl ${aguardandoTriagem ? 'border-yellow-200 bg-yellow-50' : podeCharmar ? 'border-gray-200 hover:border-blue-300' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{agendamento.nome_paciente}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{agendamento.hora?.slice(0, 5)}</span>
                          {agendamento.procedimento && <span className="px-2 py-0.5 bg-gray-100 rounded text-xs truncate max-w-[150px]">{agendamento.procedimento}</span>}
                        </div>
                        {aguardandoTriagem && <p className="text-xs text-yellow-700 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Aguardando triagem IMESC</p>}
                        {agendamento.triagem_concluida && <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Triagem concluída ✓</p>}
                      </div>
                      <button onClick={() => chamarPaciente(agendamento)} disabled={!podeCharmar || loadingAction === `chamar-${agendamento.id}`} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
                        {loadingAction === `chamar-${agendamento.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}Chamar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <ChamadasAtivasList chamadas={chamadas} title="Chamadas Ativas" subtitle="todas as salas" accentColorClass="text-blue-500" currentUserName={usuario?.nome ?? null} className="mt-8" />
      </main>
    </div>
  );
}
