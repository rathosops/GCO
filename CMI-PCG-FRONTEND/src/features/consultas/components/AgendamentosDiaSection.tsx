/**
 * Seção de Agendamentos do Dia para a página de Consultas
 * 
 * Exibe os agendamentos do dia atual em cards compactos
 * com opção de iniciar atendimento diretamente
 */

import { motion } from 'framer-motion';
import { Calendar, Loader2, RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import type { Agendamento, Paciente } from '@/types';
import type { AutocompletePaciente } from '@/services/autocomplete.api';
import { AgendamentoDiaCard } from './AgendamentoDiaCard';

interface AgendamentosDiaSectionProps {
  agendamentos: Agendamento[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onIniciarAtendimento: (
    agendamento: Agendamento,
    paciente: Paciente | AutocompletePaciente | null
  ) => void;
}

export function AgendamentosDiaSection({
  agendamentos,
  loading,
  error,
  onReload,
  onIniciarAtendimento,
}: AgendamentosDiaSectionProps) {
  // Separa agendamentos pendentes dos já atendidos
  const pendentes = agendamentos.filter(
    (ag) => !ag.status || ag.status === 'AGENDADO' || ag.status === 'CONFIRMADO'
  );
  const atendidos = agendamentos.filter(
    (ag) => ag.status === 'REALIZADO' || ag.status === 'FALTOU' || ag.status === 'CANCELADO'
  );

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 text-primary-600 animate-spin" />
          <span className="ml-2 text-secondary-600">Carregando agendamentos...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border-red-200">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <div className="flex-1">
            <p className="font-medium text-red-700">Erro ao carregar agendamentos</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button onClick={onReload} className="btn-secondary text-sm">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-xl">
            <Calendar className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-secondary-900">Agendamentos de Hoje</h3>
            <p className="text-sm text-secondary-500 capitalize">{hoje}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Contadores */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-secondary-700">{pendentes.length}</span>
              <span className="text-secondary-500">pendentes</span>
            </div>
            {atendidos.length > 0 && (
              <div className="text-secondary-400">
                {atendidos.length} atendido{atendidos.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          <button onClick={onReload} className="btn-ghost p-2" title="Atualizar agendamentos">
            <RefreshCw className="h-4 w-4 text-secondary-500" />
          </button>
        </div>
      </div>

      {/* Lista de Agendamentos */}
      {agendamentos.length === 0 ? (
        <div className="py-8 text-center">
          <Calendar className="h-12 w-12 mx-auto text-secondary-300 mb-3" />
          <p className="text-secondary-600 font-medium">Nenhum agendamento para hoje</p>
          <p className="text-sm text-secondary-500">Os agendamentos aparecerão aqui quando houver.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pendentes primeiro */}
          {pendentes.length > 0 && (
            <div className="space-y-3">
              {pendentes.map((ag, index) => (
                <AgendamentoDiaCard
                  key={ag.id}
                  agendamento={ag}
                  index={index}
                  onIniciarAtendimento={onIniciarAtendimento}
                />
              ))}
            </div>
          )}

          {/* Separador se houver ambos */}
          {pendentes.length > 0 && atendidos.length > 0 && (
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 border-t border-secondary-200" />
              <span className="text-xs text-secondary-400 font-medium">Já atendidos</span>
              <div className="flex-1 border-t border-secondary-200" />
            </div>
          )}

          {/* Atendidos por último (colapsados) */}
          {atendidos.length > 0 && (
            <motion.div
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 0.6 }}
              className="space-y-2"
            >
              {atendidos.map((ag, index) => (
                <AgendamentoDiaCard
                  key={ag.id}
                  agendamento={ag}
                  index={pendentes.length + index}
                  onIniciarAtendimento={onIniciarAtendimento}
                />
              ))}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}