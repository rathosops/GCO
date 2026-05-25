/**
 * Card de agendamento do dia para a página de Consultas
 * 
 * Exibe:
 * - Status do agendamento (badge colorido)
 * - Horário
 * - Nome do paciente
 * - Procedimento
 * - Botão "Iniciar Atendimento" que abre modal de consulta pré-preenchido
 * 
 * Match de paciente:
 * - Se tem CPF no agendamento, busca paciente exato
 * - Se não tem CPF, mostra sugestões de pacientes com nome similar
 */

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  PlayCircle,
  User,
  AlertCircle,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Phone,
} from 'lucide-react';
import type { Agendamento, Paciente } from '@/types';
import type { AutocompletePaciente } from '@/services/autocomplete.api';
import { autocompleteAPI } from '@/services/autocomplete.api';
import { pacientesAPI } from '@/services/api';
import { onlyDigits } from '@/utils/formatters';

// ============================================
// Types
// ============================================

type StatusConfig = {
  label: string;
  color: string;
  bgColor: string;
};

type PatientMatchResult = {
  type: 'exact' | 'similar' | 'none';
  paciente?: Paciente | null;
  suggestions?: AutocompletePaciente[];
};

type Props = {
  agendamento: Agendamento;
  index: number;
  onIniciarAtendimento: (
    agendamento: Agendamento,
    paciente: Paciente | AutocompletePaciente | null
  ) => void;
};

// ============================================
// Helpers
// ============================================

const statusMap: Record<string, StatusConfig> = {
  AGENDADO: { label: 'Agendado', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  CONFIRMADO: { label: 'Confirmado', color: 'text-primary-700', bgColor: 'bg-primary-100' },
  REALIZADO: { label: 'Realizado', color: 'text-success-dark', bgColor: 'bg-success-light' },
  CANCELADO: { label: 'Cancelado', color: 'text-secondary-600', bgColor: 'bg-secondary-100' },
  FALTOU: { label: 'Faltou', color: 'text-warning-dark', bgColor: 'bg-warning-light' },
};

function normalizeHora(h?: string | null): string {
  if (!h) return '--:--';
  const match = h.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return h;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function getStatusFromAgendamento(ag: Agendamento): string {
  if (ag.status) return ag.status;
  if (ag.paciente_compareceu === true) return 'REALIZADO';
  if (ag.paciente_compareceu === false) return 'FALTOU';
  return 'AGENDADO';
}

function getStatusConfig(status: string): StatusConfig {
  return statusMap[status] || statusMap.AGENDADO;
}

// ============================================
// Component
// ============================================

export function AgendamentoDiaCard({ agendamento, index, onIniciarAtendimento }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [matchResult, setMatchResult] = useState<PatientMatchResult>({ type: 'none' });
  const [matchLoading, setMatchLoading] = useState(false);
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | AutocompletePaciente | null>(null);

  const status = getStatusFromAgendamento(agendamento);
  const statusConfig = getStatusConfig(status);
  const hora = normalizeHora(agendamento.hora);

  // Verifica se o agendamento já foi atendido
  const jaAtendido = status === 'REALIZADO' || status === 'CANCELADO' || status === 'FALTOU';

  // Busca match de paciente ao expandir
  const searchPatientMatch = useCallback(async () => {
    if (matchResult.type !== 'none' || matchLoading) return;

    const cpfRaw = agendamento.cpf_paciente ? onlyDigits(String(agendamento.cpf_paciente)) : '';
    const nome = agendamento.nome_paciente?.trim() || '';

    if (!cpfRaw && !nome) {
      setMatchResult({ type: 'none' });
      return;
    }

    setMatchLoading(true);

    try {
      // Se tem CPF válido (11 dígitos), busca exato
      if (cpfRaw && cpfRaw.length === 11) {
        try {
          const paciente = await pacientesAPI.getByCpf(cpfRaw);
          if (paciente) {
            setMatchResult({ type: 'exact', paciente });
            setSelectedPaciente(paciente);
            return;
          }
        } catch {
          // CPF não encontrado, continua para busca por nome
        }
      }

      // Busca por nome similar
      if (nome && nome.length >= 2) {
        const suggestions = await autocompleteAPI.pacientes(nome, { limit: 5 });
        if (suggestions && suggestions.length > 0) {
          setMatchResult({ type: 'similar', suggestions });
          return;
        }
      }

      setMatchResult({ type: 'none' });
    } catch (err) {
      console.error('Erro ao buscar paciente:', err);
      setMatchResult({ type: 'none' });
    } finally {
      setMatchLoading(false);
    }
  }, [agendamento.cpf_paciente, agendamento.nome_paciente, matchLoading, matchResult.type]);

  // Busca match quando expande
  useEffect(() => {
    if (expanded && matchResult.type === 'none' && !matchLoading) {
      searchPatientMatch();
    }
  }, [expanded, matchResult.type, matchLoading, searchPatientMatch]);

  const handleIniciarAtendimento = () => {
    onIniciarAtendimento(agendamento, selectedPaciente);
  };

  const handleSelectSuggestion = (pac: AutocompletePaciente) => {
    setSelectedPaciente(pac);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-xl border transition-all ${
        jaAtendido
          ? 'bg-secondary-50 border-secondary-200 opacity-60'
          : 'bg-white border-secondary-200 hover:border-primary-300 hover:shadow-md'
      }`}
    >
      {/* Header do Card */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Horário */}
          <div className="flex items-center gap-2 min-w-[70px]">
            <Clock className="h-4 w-4 text-primary-500" />
            <span className="text-lg font-bold text-secondary-900">{hora}</span>
          </div>

          {/* Info do Paciente */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-secondary-400" />
              <span className="font-semibold text-secondary-900 truncate">
                {agendamento.nome_paciente || 'Paciente não informado'}
              </span>
            </div>

            {agendamento.procedimento && (
              <p className="text-sm text-secondary-600 truncate">{agendamento.procedimento}</p>
            )}

            {agendamento.numero_de_contato && (
              <div className="flex items-center gap-1 mt-1 text-xs text-secondary-500">
                <Phone className="h-3 w-3" />
                <span>{String(agendamento.numero_de_contato)}</span>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
            {statusConfig.label}
          </div>

          {/* Botões de Ação */}
          {!jaAtendido && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="btn-ghost p-2"
                title={expanded ? 'Recolher' : 'Expandir para selecionar paciente'}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4 text-secondary-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-secondary-500" />
                )}
              </button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleIniciarAtendimento}
                className="btn-primary text-sm"
                title="Iniciar atendimento"
              >
                <PlayCircle className="h-4 w-4" />
                Iniciar Atendimento
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Seção Expandida - Match de Paciente */}
      {expanded && !jaAtendido && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-secondary-200 bg-secondary-50 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-secondary-500" />
            <span className="text-sm font-medium text-secondary-700">Vincular Paciente Cadastrado</span>
          </div>

          {matchLoading ? (
            <div className="flex items-center gap-2 text-sm text-secondary-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando paciente...
            </div>
          ) : matchResult.type === 'exact' && matchResult.paciente ? (
            // Match exato por CPF
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Paciente encontrado por CPF</span>
              </div>
              <p className="text-sm font-semibold text-secondary-900">{matchResult.paciente.nome}</p>
              <p className="text-xs text-secondary-600">CPF: {matchResult.paciente.cpf}</p>
            </div>
          ) : matchResult.type === 'similar' && matchResult.suggestions?.length ? (
            // Sugestões por nome similar
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <AlertCircle className="h-4 w-4" />
                <span>CPF não informado. Selecione o paciente correspondente:</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {matchResult.suggestions.map((pac) => (
                  <button
                    key={pac.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(pac)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedPaciente && (selectedPaciente as AutocompletePaciente).id === pac.id
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                        : 'border-secondary-200 bg-white hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-secondary-900">{pac.nome}</p>
                        <p className="text-xs text-secondary-500">CPF: {pac.cpf}</p>
                        {pac.empresa_nome && (
                          <p className="text-xs text-secondary-500">Empresa: {pac.empresa_nome}</p>
                        )}
                      </div>
                      {selectedPaciente && (selectedPaciente as AutocompletePaciente).id === pac.id && (
                        <CheckCircle className="h-5 w-5 text-primary-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Nenhum match
            <div className="flex items-center gap-2 text-sm text-secondary-600">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span>
                Paciente não encontrado no cadastro. Será criado a partir do nome do agendamento.
              </span>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}