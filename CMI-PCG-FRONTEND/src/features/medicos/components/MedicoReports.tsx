/**
 * Componentes de Relatórios de Médicos
 * 
 * Cards e visualizações para o dashboard de relatórios.
 */

import { motion } from 'framer-motion';
import {
  Users,
  Calendar,
  TrendingUp,
  Award,
  Loader2,
  AlertCircle,
  ChevronRight,
  Stethoscope,
  Clock,
  Activity,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import type {
  RelatorioResumoMedicos,
  RelatorioPorEspecialidade,
  RelatorioProdutividade,
  RelatorioOcupacao,
  MedicoRanking,
} from '../types';


// Cores para gráficos
const COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#4F46E5', '#EA580C'];


// ============================================
// Card de Resumo (KPIs)
// ============================================
interface ResumoMedicosCardProps {
  resumo: RelatorioResumoMedicos | null;
  loading?: boolean;
  periodo?: string;
  onPeriodoChange?: (p: string) => void;
}

export function ResumoMedicosCard({ resumo, loading, periodo = '30dias', onPeriodoChange }: ResumoMedicosCardProps) {
  if (loading) {
    return (
      <div className="card flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  if (!resumo) {
    return (
      <div className="card flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-8 w-8 text-secondary-300 mb-2" />
        <p className="text-secondary-500">Dados não disponíveis</p>
      </div>
    );
  }
  
  const { totais, metricas } = resumo;
  
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-secondary-900">Resumo</h3>
        {onPeriodoChange && (
          <select
            value={periodo}
            onChange={(e) => onPeriodoChange(e.target.value)}
            className="select text-sm w-auto"
          >
            <option value="7dias">Últimos 7 dias</option>
            <option value="30dias">Últimos 30 dias</option>
            <option value="90dias">Últimos 90 dias</option>
            <option value="12meses">Últimos 12 meses</option>
            <option value="todos">Todo período</option>
          </select>
        )}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-amber-50">
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-amber-600">Médicos</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">
            {totais.total_medicos}
          </p>
          <p className="text-xs text-amber-600">
            {totais.medicos_ativos} ativos
          </p>
        </div>
        
        <div className="card bg-primary-50">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-primary-600" />
            <span className="text-xs text-primary-600">Consultas</span>
          </div>
          <p className="text-2xl font-bold text-primary-700">{totais.total_consultas}</p>
        </div>
        
        <div className="card bg-green-50">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-600">Pacientes</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{totais.pacientes_atendidos}</p>
        </div>
        
        <div className="card bg-purple-50">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-purple-600">Taxa Ocupação</span>
          </div>
          <p className="text-2xl font-bold text-purple-700">
            {metricas.taxa_ocupacao}%
          </p>
        </div>
      </div>
      
      {/* Média por médico */}
      <div className="mt-4 flex items-center gap-2 text-sm text-secondary-600">
        <Activity className="h-4 w-4 text-secondary-400" />
        <span>
          Média de <strong>{metricas.media_consultas_por_medico}</strong> consultas por médico ativo
        </span>
      </div>
    </div>
  );
}


// ============================================
// Ranking de Médicos por Consultas
// ============================================
interface RankingMedicosProps {
  ranking: MedicoRanking[];
  loading?: boolean;
  onMedicoClick?: (id: number) => void;
}

export function RankingMedicos({ ranking, loading, onMedicoClick }: RankingMedicosProps) {
  if (loading) {
    return (
      <div className="card h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  if (!ranking || ranking.length === 0) {
    return (
      <div className="card h-64 flex flex-col items-center justify-center">
        <Award className="h-8 w-8 text-secondary-300 mb-2" />
        <p className="text-secondary-500">Nenhum médico encontrado</p>
      </div>
    );
  }
  
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-secondary-900 mb-4">
        Top Médicos por Consultas
      </h3>
      
      <div className="space-y-2">
        {ranking.slice(0, 10).map((m, index) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary-50 cursor-pointer transition-colors"
            onClick={() => onMedicoClick?.(m.id)}
          >
            <span className={`w-6 h-6 flex items-center justify-center text-sm font-bold rounded-full ${
              index === 0 ? 'bg-amber-100 text-amber-700' :
              index === 1 ? 'bg-gray-200 text-gray-700' :
              index === 2 ? 'bg-orange-100 text-orange-700' :
              'bg-secondary-100 text-secondary-500'
            }`}>
              {m.posicao}
            </span>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-secondary-900 truncate">
                {m.nome}
              </p>
              <p className="text-xs text-secondary-500">
                {m.especialidade || m.crm_formatado}
              </p>
            </div>
            
            <div className="text-right">
              <p className="text-sm font-bold text-primary-600">{m.total_consultas}</p>
              <p className="text-xs text-secondary-500">{m.pacientes_unicos} pac.</p>
            </div>
            
            <ChevronRight className="h-4 w-4 text-secondary-400" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}


// ============================================
// Distribuição por Especialidade
// ============================================
interface EspecialidadeChartProps {
  relatorio: RelatorioPorEspecialidade | null;
  loading?: boolean;
}

export function EspecialidadeChart({ relatorio, loading }: EspecialidadeChartProps) {
  if (loading) {
    return (
      <div className="card h-80 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  if (!relatorio || !relatorio.especialidades || relatorio.especialidades.length === 0) {
    return (
      <div className="card h-80 flex flex-col items-center justify-center">
        <Stethoscope className="h-8 w-8 text-secondary-300 mb-2" />
        <p className="text-secondary-500">Sem dados de especialidades</p>
      </div>
    );
  }
  
  const pieData = relatorio.especialidades.slice(0, 6).map((e, i) => ({
    name: e.especialidade,
    value: e.total_consultas,
    color: COLORS[i % COLORS.length],
  }));
  
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-secondary-900 mb-4">
        Consultas por Especialidade
      </h3>
      
      <div className="flex items-center gap-6">
        <div className="w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex-1 space-y-2">
          {relatorio.especialidades.slice(0, 6).map((item, i) => (
            <div key={item.especialidade} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-sm text-secondary-700 truncate max-w-[120px]">
                  {item.especialidade}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-secondary-900">
                  {item.total_consultas}
                </span>
                <span className="text-xs text-secondary-500 ml-1">
                  ({item.total_medicos} méd.)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ============================================
// Gráfico de Produtividade Mensal
// ============================================
interface ProdutividadeChartProps {
  produtividade: RelatorioProdutividade | null;
  loading?: boolean;
}

export function ProdutividadeChart({ produtividade, loading }: ProdutividadeChartProps) {
  if (loading) {
    return (
      <div className="card h-80 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  if (!produtividade || !produtividade.historico || produtividade.historico.length === 0) {
    return (
      <div className="card h-80 flex flex-col items-center justify-center">
        <TrendingUp className="h-8 w-8 text-secondary-300 mb-2" />
        <p className="text-secondary-500">Sem dados de produtividade</p>
      </div>
    );
  }
  
  const chartData = produtividade.historico.map((h) => ({
    nome: h.mes_nome?.slice(0, 3) || String(h.mes),
    consultas: h.total_consultas,
    medicos: h.medicos_ativos,
    media: h.media_por_medico,
  }));
  
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-secondary-900">
          Produtividade Mensal
        </h3>
        <div className="text-sm text-secondary-500">
          Média: <strong>{produtividade.totais.media_mensal}</strong> consultas/mês
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="nome" tick={{ fontSize: 11 }} stroke="#6B7280" />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#6B7280" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#6B7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
              }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="consultas"
              stroke="#2563EB"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Consultas"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="medicos"
              stroke="#7C3AED"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Médicos Ativos"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


// ============================================
// Gráfico de Ocupação
// ============================================
interface OcupacaoChartProps {
  ocupacao: RelatorioOcupacao | null;
  loading?: boolean;
}

export function OcupacaoChart({ ocupacao, loading }: OcupacaoChartProps) {
  if (loading) {
    return (
      <div className="card h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  if (!ocupacao) {
    return (
      <div className="card h-64 flex flex-col items-center justify-center">
        <Clock className="h-8 w-8 text-secondary-300 mb-2" />
        <p className="text-secondary-500">Sem dados de ocupação</p>
      </div>
    );
  }
  
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-secondary-900">
          Ocupação da Agenda
        </h3>
        {ocupacao.insights && (
          <div className="flex gap-4 text-xs text-secondary-500">
            {ocupacao.insights.dia_mais_movimentado && (
              <span>
                🔥 Pico: <strong>{ocupacao.insights.dia_mais_movimentado}</strong>
              </span>
            )}
            {ocupacao.insights.horario_pico && (
              <span>
                ⏰ Horário: <strong>{ocupacao.insights.horario_pico}</strong>
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Por dia da semana */}
        {ocupacao.ocupacao_semana && ocupacao.ocupacao_semana.length > 0 && (
          <div>
            <p className="text-sm text-secondary-600 mb-2">Por Dia da Semana</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ocupacao.ocupacao_semana} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#6B7280" />
                  <YAxis
                    type="category"
                    dataKey="dia"
                    tick={{ fontSize: 11 }}
                    stroke="#6B7280"
                    width={60}
                  />
                  <Tooltip />
                  <Bar dataKey="total" fill="#2563EB" radius={[0, 4, 4, 0]} name="Consultas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Por horário */}
        {ocupacao.ocupacao_horario && ocupacao.ocupacao_horario.length > 0 && (
          <div>
            <p className="text-sm text-secondary-600 mb-2">Por Horário</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ocupacao.ocupacao_horario}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="hora" tick={{ fontSize: 11 }} stroke="#6B7280" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" />
                  <Tooltip />
                  <Bar dataKey="total" fill="#7C3AED" radius={[4, 4, 0, 0]} name="Consultas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export default ResumoMedicosCard;