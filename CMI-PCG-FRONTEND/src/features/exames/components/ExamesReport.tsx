/**
 * Relatório de exames mais solicitados
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Trophy, Calendar, Loader2 } from 'lucide-react';
import { useExamesMaisSolicitados } from '../hooks';
import type { ExameMaisSolicitado } from '../types';

interface ExamesReportProps {
  data?: ExameMaisSolicitado[];
  loading?: boolean;
}

export function ExamesReport({ data: propData, loading: propLoading }: ExamesReportProps) {
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

  const { data: hookData, loading: hookLoading } = useExamesMaisSolicitados(getDates());

  const data = propData ?? hookData;
  const loading = propLoading ?? hookLoading;
  const maxTotal = data.length > 0 ? Math.max(...data.map((d) => d.total)) : 1;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-text-100">Exames Mais Solicitados</h3>
            <p className="text-sm text-text-200">Ranking por solicitações</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-text-200" />
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
            className="input py-1.5 text-sm"
          >
            <option value="mes">Este mês</option>
            <option value="trimestre">3 meses</option>
            <option value="ano">Este ano</option>
            <option value="todos">Tudo</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-primary-100 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-text-200">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma solicitação no período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item, i) => (
            <motion.div
              key={item.nome}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="relative"
            >
              <div className="flex items-center gap-3 relative z-10 py-2">
                <div
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs
                    ${i === 0 ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${i === 1 ? 'bg-gray-100 text-gray-700' : ''}
                    ${i === 2 ? 'bg-orange-100 text-orange-700' : ''}
                    ${i > 2 ? 'bg-bg-200 text-text-200' : ''}
                  `}
                >
                  {item.posicao}
                </div>
                <p className="flex-1 text-sm font-medium text-text-100 truncate">{item.nome}</p>
                <span className="font-bold text-text-100 text-sm tabular-nums">{item.total}</span>
              </div>
              <div className="absolute bottom-0 left-10 right-0 h-1 bg-bg-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.total / maxTotal) * 100}%` }}
                  transition={{ delay: i * 0.03 + 0.2, duration: 0.5 }}
                  className={`h-full rounded-full ${
                    i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-500' : 'bg-primary-100'
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