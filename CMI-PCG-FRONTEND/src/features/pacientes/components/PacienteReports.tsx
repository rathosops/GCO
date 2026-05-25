/**
 * Componentes de Relatórios de Pacientes
 * 
 * Cards e visualizações para o dashboard de relatórios.
 */

import { motion } from 'framer-motion';
import {
  Users,
  Calendar,
  TrendingUp,
  Award,
  Gift,
  UserX,
  Building2,
  Heart,
  Loader2,
  AlertCircle,
  ChevronRight,
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
  RelatorioResumo,
  ConsultasPorMes,
  RelatorioFidelidade,
  Aniversariante,
  PacienteInativo,
  PacientesPorEmpresa,
  PacientesPorConvenio,
  TopPacienteFidelidade,
} from '../types';
import { FidelidadeBadge } from './PacienteCard';


// ============================================
// Constantes
// ============================================
const FIDELIDADE_COLORS = {
  novo: '#9CA3AF',    // gray
  bronze: '#D97706',  // amber
  prata: '#64748B',   // slate
  ouro: '#EAB308',    // yellow
};


// ============================================
// Card de Resumo (KPIs)
// ============================================
interface ResumoCardProps {
  resumo: RelatorioResumo | null;
  loading?: boolean;
  periodo?: string;
  onPeriodoChange?: (p: string) => void;
}

export function ResumoCard({ resumo, loading, periodo = '30dias', onPeriodoChange }: ResumoCardProps) {
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
  
  const { totais, periodo_stats: ps } = resumo;
  
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
        <div className="card bg-primary-50">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-primary-600" />
            <span className="text-xs text-primary-600">Total Pacientes</span>
          </div>
          <p className="text-2xl font-bold text-primary-700">
            {totais.total_pacientes ?? totais.pacientes ?? 0}
          </p>
        </div>
        
        <div className="card bg-green-50">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-600">Consultas</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{ps.consultas}</p>
        </div>
        
        <div className="card bg-purple-50">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-purple-600">Atendidos</span>
          </div>
          <p className="text-2xl font-bold text-purple-700">{ps.pacientes_atendidos}</p>
        </div>
        
        <div className="card bg-amber-50">
          <div className="flex items-center gap-2 mb-1">
            <Award className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-amber-600">Taxa Retorno</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">
            {ps.taxa_retorno ?? ps.taxa_retorno_percent ?? 0}%
          </p>
        </div>
      </div>
      
      {/* Distribuição por Sexo */}
      {resumo.distribuicao_sexo && (
        <div className="mt-4 flex gap-6 text-sm text-secondary-600">
          <span>
            ♂ Masculino: <strong>{resumo.distribuicao_sexo.masculino}</strong>
          </span>
          <span>
            ♀ Feminino: <strong>{resumo.distribuicao_sexo.feminino}</strong>
          </span>
          {resumo.distribuicao_sexo.nao_informado > 0 && (
            <span>
              Não informado: <strong>{resumo.distribuicao_sexo.nao_informado}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}


// ============================================
// Gráfico de Consultas por Mês
// ============================================
interface ConsultasPorMesChartProps {
  dados: ConsultasPorMes[];
  loading?: boolean;
}

export function ConsultasPorMesChart({ dados, loading }: ConsultasPorMesChartProps) {
  if (loading) {
    return (
      <div className="card h-80 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  if (!dados || dados.length === 0) {
    return (
      <div className="card h-80 flex flex-col items-center justify-center">
        <AlertCircle className="h-8 w-8 text-secondary-300 mb-2" />
        <p className="text-secondary-500">Sem dados para exibir</p>
      </div>
    );
  }
  
  const chartData = dados.map((d) => ({
    nome: d.mes_nome?.slice(0, 3) || d.mes?.toString().slice(0, 3) || '',
    consultas: d.total_consultas,
    pacientes: d.pacientes_unicos,
  }));
  
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-secondary-900 mb-4">
        Consultas por Mês
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="nome" tick={{ fontSize: 12 }} stroke="#6B7280" />
            <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
              }}
            />
            <Line
              type="monotone"
              dataKey="consultas"
              stroke="#2563EB"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Consultas"
            />
            <Line
              type="monotone"
              dataKey="pacientes"
              stroke="#7C3AED"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Pacientes"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


// ============================================
// Distribuição de Fidelidade (Pie Chart)
// ============================================
interface FidelidadeDistributionProps {
  fidelidade: RelatorioFidelidade | null;
  loading?: boolean;
}

export function FidelidadeDistribution({ fidelidade, loading }: FidelidadeDistributionProps) {
  if (loading) {
    return (
      <div className="card h-80 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  if (!fidelidade) {
    return (
      <div className="card h-80 flex flex-col items-center justify-center">
        <AlertCircle className="h-8 w-8 text-secondary-300 mb-2" />
        <p className="text-secondary-500">Dados não disponíveis</p>
      </div>
    );
  }
  
  const { distribuicao_niveis: dist } = fidelidade;
  
  const pieData = [
    { name: 'Novo', value: dist.novo, color: FIDELIDADE_COLORS.novo },
    { name: 'Bronze', value: dist.bronze, color: FIDELIDADE_COLORS.bronze },
    { name: 'Prata', value: dist.prata, color: FIDELIDADE_COLORS.prata },
    { name: 'Ouro', value: dist.ouro, color: FIDELIDADE_COLORS.ouro },
  ].filter((d) => d.value > 0);
  
  const regras = fidelidade.regras_programa;
  
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-secondary-900">
          Programa de Fidelidade
        </h3>
        <span className="text-sm text-secondary-500">
          {fidelidade.total_pontos_emitidos} pontos emitidos
        </span>
      </div>
      
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
          {pieData.map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-secondary-700">{item.name}</span>
              </div>
              <span className="text-sm font-medium text-secondary-900">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Regras do programa */}
      {regras && (
        <div className="mt-4 pt-4 border-t border-secondary-200">
          <p className="text-xs text-secondary-500 mb-2">Regras do Programa:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span>
              🥉 Bronze: {regras.bronze?.min_consultas ?? regras.niveis?.bronze?.min_consultas}+ consultas 
              ({regras.bronze?.desconto ?? 5}% desc.)
            </span>
            <span>
              🥈 Prata: {regras.prata?.min_consultas ?? regras.niveis?.prata?.min_consultas}+ consultas 
              ({regras.prata?.desconto ?? 10}% desc.)
            </span>
            <span>
              🥇 Ouro: {regras.ouro?.min_consultas ?? regras.niveis?.ouro?.min_consultas}+ consultas 
              ({regras.ouro?.desconto ?? 15}% desc.)
            </span>
            <span>⭐ {regras.pontos_por_consulta} pontos por consulta</span>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================
// Top Pacientes (Leaderboard)
// ============================================
interface TopPacientesTableProps {
  fidelidade: RelatorioFidelidade | null;
  loading?: boolean;
  onPacienteClick?: (id: number) => void;
}

export function TopPacientesTable({ fidelidade, loading, onPacienteClick }: TopPacientesTableProps) {
  if (loading) {
    return (
      <div className="card h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  const topPacientes = fidelidade?.top_pacientes || [];
  
  if (topPacientes.length === 0) {
    return (
      <div className="card h-64 flex flex-col items-center justify-center">
        <Award className="h-8 w-8 text-secondary-300 mb-2" />
        <p className="text-secondary-500">Nenhum paciente frequente</p>
      </div>
    );
  }
  
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-secondary-900 mb-4">
        Top 10 Pacientes
      </h3>
      
      <div className="space-y-2">
        {topPacientes.map((p: TopPacienteFidelidade, index: number) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary-50 cursor-pointer transition-colors"
            onClick={() => onPacienteClick?.(p.id)}
          >
            <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-secondary-500">
              {index + 1}º
            </span>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-secondary-900 truncate">
                {p.nome}
              </p>
              <p className="text-xs text-secondary-500">
                {p.total_consultas} consultas • {p.pontos_fidelidade ?? p.pontos} pts
              </p>
            </div>
            
            <FidelidadeBadge nivel={p.nivel_fidelidade ?? p.nivel} />
            
            <ChevronRight className="h-4 w-4 text-secondary-400" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}


// ============================================
// Card de Aniversariantes
// ============================================
interface AniversariantesCardProps {
  aniversariantes: Aniversariante[];
  loading?: boolean;
  titulo?: string;
}

export function AniversariantesCard({
  aniversariantes,
  loading,
  titulo = 'Aniversariantes do Mês',
}: AniversariantesCardProps) {
  if (loading) {
    return (
      <div className="card h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  if (aniversariantes.length === 0) {
    return (
      <div className="card h-64 flex flex-col items-center justify-center">
        <Gift className="h-8 w-8 text-secondary-300 mb-2" />
        <p className="text-secondary-500">Nenhum aniversariante</p>
      </div>
    );
  }
  
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Gift className="h-5 w-5 text-pink-500" />
        <h3 className="text-lg font-semibold text-secondary-900">{titulo}</h3>
        <span className="ml-auto px-2 py-0.5 bg-pink-100 text-pink-700 text-xs rounded-full">
          {aniversariantes.length}
        </span>
      </div>
      
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {aniversariantes.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 p-2 bg-pink-50 rounded-lg"
          >
            <div className="w-10 h-10 flex items-center justify-center bg-pink-100 text-pink-700 font-bold rounded-full">
              {a.dia}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-secondary-900 truncate">
                {a.nome}
              </p>
              <p className="text-xs text-secondary-500">
                {a.idade !== undefined ? `${a.idade} anos` : (a.data_nascimento_br ?? a.data_nascimento)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ============================================
// Tabela de Inativos (Recall)
// ============================================
interface InativosTableProps {
  inativos: PacienteInativo[];
  loading?: boolean;
  diasCorte?: number;
  onPacienteClick?: (id: number) => void;
}

export function InativosTable({
  inativos,
  loading,
  diasCorte = 180,
  onPacienteClick,
}: InativosTableProps) {
  if (loading) {
    return (
      <div className="card h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  if (inativos.length === 0) {
    return (
      <div className="card h-64 flex flex-col items-center justify-center">
        <UserX className="h-8 w-8 text-secondary-300 mb-2" />
        <p className="text-secondary-500">Nenhum paciente inativo</p>
      </div>
    );
  }
  
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <UserX className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-semibold text-secondary-900">
          Pacientes Inativos
        </h3>
        <span className="ml-auto text-xs text-secondary-500">
          Sem consulta há {diasCorte}+ dias
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-secondary-500 border-b">
              <th className="pb-2 font-medium">Paciente</th>
              <th className="pb-2 font-medium">Última Consulta</th>
              <th className="pb-2 font-medium">Dias</th>
              <th className="pb-2 font-medium">Contato</th>
            </tr>
          </thead>
          <tbody>
            {inativos.slice(0, 10).map((p) => (
              <tr
                key={p.id}
                className="border-b border-secondary-100 hover:bg-secondary-50 cursor-pointer"
                onClick={() => onPacienteClick?.(p.id)}
              >
                <td className="py-2">
                  <p className="font-medium text-secondary-900">{p.nome}</p>
                  <p className="text-xs text-secondary-500">{p.cpf}</p>
                </td>
                <td className="py-2 text-secondary-600">
                  {p.ultima_consulta_br ?? p.ultima_consulta ?? '-'}
                </td>
                <td className="py-2">
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                    {p.dias_sem_consulta}d
                  </span>
                </td>
                <td className="py-2 text-secondary-600">
                  {p.telefone || p.email || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {inativos.length > 10 && (
        <p className="text-xs text-secondary-500 mt-3 text-center">
          Mostrando 10 de {inativos.length} pacientes inativos
        </p>
      )}
    </div>
  );
}


// ============================================
// Ranking por Empresa / Convênio
// ============================================
interface RankingBarChartProps {
  dados: PacientesPorEmpresa[] | PacientesPorConvenio[];
  tipo: 'empresa' | 'convenio';
  loading?: boolean;
}

export function RankingBarChart({ dados, tipo, loading }: RankingBarChartProps) {
  if (loading) {
    return (
      <div className="card h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  if (!dados || dados.length === 0) {
    return (
      <div className="card h-64 flex flex-col items-center justify-center">
        {tipo === 'empresa' ? (
          <Building2 className="h-8 w-8 text-secondary-300 mb-2" />
        ) : (
          <Heart className="h-8 w-8 text-secondary-300 mb-2" />
        )}
        <p className="text-secondary-500">
          Nenhum paciente vinculado a {tipo === 'empresa' ? 'empresas' : 'convênios'}
        </p>
      </div>
    );
  }
  
  const chartData = dados.slice(0, 8).map((d) => ({
    nome: d.nome?.slice(0, 15) || 'N/A',
    total: d.total_pacientes,
  }));
  
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        {tipo === 'empresa' ? (
          <Building2 className="h-5 w-5 text-blue-500" />
        ) : (
          <Heart className="h-5 w-5 text-rose-500" />
        )}
        <h3 className="text-lg font-semibold text-secondary-900">
          Pacientes por {tipo === 'empresa' ? 'Empresa' : 'Convênio'}
        </h3>
      </div>
      
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke="#6B7280" />
            <YAxis
              type="category"
              dataKey="nome"
              tick={{ fontSize: 11 }}
              stroke="#6B7280"
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
              }}
            />
            <Bar
              dataKey="total"
              fill={tipo === 'empresa' ? '#2563EB' : '#E11D48'}
              radius={[0, 4, 4, 0]}
              name="Pacientes"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


export default ResumoCard;