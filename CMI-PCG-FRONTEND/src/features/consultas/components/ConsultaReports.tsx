/**
 * Componentes de relatórios para consultas
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Trophy,
  Users,
  UserCheck,
  Calendar,
  Loader2,
  Stethoscope,
} from 'lucide-react';
import {
  useConsultasPorTipo,
  useConsultasPorMedico,
  usePacientesFrequentes,
  useResumoMensal,
} from '../hooks';

// =============================================================================
// Relatório: Consultas por Tipo
// =============================================================================
export function ConsultasPorTipoReport() {
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ano' | 'todos'>('mes');

  const getDates = () => {
    const hoje = new Date();
    const dataFim = hoje.toISOString().split('T')[0];
    let dataInicio: string | undefined;

    switch (periodo) {
      case 'mes':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
        break;
      case 'trimestre':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1).toISOString().split('T')[0];
        break;
      case 'ano':
        dataInicio = new Date(hoje.getFullYear(), 0, 1).toISOString().split('T')[0];
        break;
      default:
        dataInicio = undefined;
    }
    return { data_inicio: dataInicio, data_fim: dataFim, limite: 15 };
  };

  const { data, loading } = useConsultasPorTipo(getDates());
  const maxTotal = data.length > 0 ? Math.max(...data.map((d) => d.total)) : 1;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-secondary-900">Por Tipo de Consulta</h3>
            <p className="text-sm text-secondary-500">Ranking dos tipos mais realizados</p>
          </div>
        </div>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
          className="input py-1.5 text-sm w-36"
        >
          <option value="mes">Este mês</option>
          <option value="trimestre">Últimos 3 meses</option>
          <option value="ano">Este ano</option>
          <option value="todos">Todo período</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-secondary-500">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma consulta encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item, index) => (
            <motion.div
              key={item.tipo}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="relative"
            >
              <div className="flex items-center gap-3 relative z-10 py-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-gray-100 text-gray-700' :
                  index === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-secondary-100 text-secondary-600'
                }`}>
                  {item.posicao}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-secondary-900 truncate">{item.tipo}</p>
                  <p className="text-xs text-secondary-500">{item.pacientes_unicos} pacientes únicos</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-secondary-900">{item.total}</span>
                  <span className="text-xs text-secondary-500 ml-1">consultas</span>
                </div>
              </div>
              <div className="absolute bottom-0 left-11 right-0 h-1 bg-secondary-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.total / maxTotal) * 100}%` }}
                  transition={{ delay: index * 0.03 + 0.2, duration: 0.5 }}
                  className={`h-full rounded-full ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-orange-500' :
                    'bg-blue-500'
                  }`}
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Relatório: Consultas por Médico
// =============================================================================
export function ConsultasPorMedicoReport() {
  const { data, loading } = useConsultasPorMedico({ limite: 10 });
  const maxTotal = data.length > 0 ? Math.max(...data.map((d) => d.total)) : 1;

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Stethoscope className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-bold text-secondary-900">Por Médico</h3>
          <p className="text-sm text-secondary-500">Consultas por profissional</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 text-primary-600 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <p className="text-center py-8 text-secondary-500">Nenhum dado</p>
      ) : (
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={item.crm} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700">
                {item.posicao}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-secondary-900 truncate">{item.nome}</p>
                <p className="text-xs text-secondary-500">
                  {item.especialidade || 'Clínico Geral'} • CRM {item.crm}
                </p>
              </div>
              <div className="text-right">
                <span className="font-bold text-secondary-900">{item.total}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Relatório: Pacientes Frequentes
// =============================================================================
export function PacientesFrequentesReport() {
  const { data, loading } = usePacientesFrequentes({ limite: 10, min_consultas: 2 });

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <UserCheck className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h3 className="font-bold text-secondary-900">Pacientes Frequentes</h3>
          <p className="text-sm text-secondary-500">Pacientes com mais consultas</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 text-primary-600 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <p className="text-center py-8 text-secondary-500">Nenhum paciente com 2+ consultas</p>
      ) : (
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={item.cpf} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary-50">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                index === 0 ? 'bg-green-100 text-green-700' :
                index === 1 ? 'bg-green-50 text-green-600' :
                'bg-secondary-100 text-secondary-600'
              }`}>
                {item.posicao}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-secondary-900 truncate">{item.nome}</p>
                <p className="text-xs text-secondary-500">
                  Última: {item.ultima_consulta ? new Date(item.ultima_consulta).toLocaleDateString('pt-BR') : '-'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-green-600">{item.total_consultas}</span>
                <p className="text-xs text-secondary-500">consultas</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Relatório: Resumo Mensal
// =============================================================================
export function ResumoMensalReport() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const { data, loading } = useResumoMensal(ano);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Calendar className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-secondary-900">Resumo Mensal</h3>
            <p className="text-sm text-secondary-500">Consultas por mês</p>
          </div>
        </div>
        <select
          value={ano}
          onChange={(e) => setAno(parseInt(e.target.value))}
          className="input py-1.5 text-sm w-24"
        >
          {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 text-primary-600 animate-spin" />
        </div>
      ) : !data ? (
        <p className="text-center py-8 text-secondary-500">Nenhum dado</p>
      ) : (
        <>
          {/* Gráfico de barras simples */}
          <div className="flex items-end gap-1 h-32 mb-4">
            {data.meses.map((m) => {
              const maxVal = Math.max(...data.meses.map((x) => x.total), 1);
              const height = (m.total / maxVal) * 100;
              return (
                <div key={m.mes} className="flex-1 flex flex-col items-center">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.5, delay: m.mes * 0.05 }}
                    className="w-full bg-indigo-500 rounded-t-sm min-h-[4px]"
                    title={`${m.nome_mes}: ${m.total} consultas`}
                  />
                  <span className="text-xs text-secondary-500 mt-1">{m.nome_mes.slice(0, 3)}</span>
                </div>
              );
            })}
          </div>

          {/* Totais */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-indigo-600">{data.totais.total}</p>
              <p className="text-xs text-secondary-500">Total no ano</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-secondary-900">{data.totais.media_mensal}</p>
              <p className="text-xs text-secondary-500">Média mensal</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Cards de Estatísticas
// =============================================================================
interface ConsultaStatsCardsProps {
  stats: {
    total: number;
    consultas_hoje: number;
    consultas_mes: number;
    com_solicitacao_exame: number;
    com_prescricao: number;
  } | null;
  loading?: boolean;
}

export function ConsultaStatsCards({ stats, loading }: ConsultaStatsCardsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-secondary-200 rounded w-20 mb-2" />
            <div className="h-8 bg-secondary-200 rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div className="card">
        <p className="text-sm text-secondary-500">Total</p>
        <p className="text-2xl font-bold text-secondary-900">{stats.total}</p>
      </div>
      <div className="card">
        <p className="text-sm text-secondary-500">Hoje</p>
        <p className="text-2xl font-bold text-green-600">{stats.consultas_hoje}</p>
      </div>
      <div className="card">
        <p className="text-sm text-secondary-500">Este Mês</p>
        <p className="text-2xl font-bold text-blue-600">{stats.consultas_mes}</p>
      </div>
      <div className="card">
        <p className="text-sm text-secondary-500">Com Exame</p>
        <p className="text-2xl font-bold text-purple-600">{stats.com_solicitacao_exame}</p>
      </div>
      <div className="card">
        <p className="text-sm text-secondary-500">Com Prescrição</p>
        <p className="text-2xl font-bold text-orange-600">{stats.com_prescricao}</p>
      </div>
    </div>
  );
}