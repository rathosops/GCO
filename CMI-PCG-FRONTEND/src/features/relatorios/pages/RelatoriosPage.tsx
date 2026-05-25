import { initialFrom } from "@/utils/initials";
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Download,
  RefreshCw,
  Clock,
  Award,
  Building2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import api from '@/services/api';

// Tipos
interface ResumoStats {
  totalConsultas: number;
  mediaConsultasDia: number;
  taxaRetorno: number;
  faturamentoTotal: number;
}

interface ConsultaMes {
  mes: string;
  ano: number;
  consultas: number;
  ocupacionais: number;
  retornos: number;
}

interface FaturamentoMes {
  mes: string;
  ano: number;
  receitas: number;
  despesas: number;
}

interface TipoConsulta {
  name: string;
  value: number;
  total: number;
  color: string;
}

interface PacienteFrequente {
  nome: string;
  cpf: string;
  consultas: number;
  ultimaConsulta: string;
  empresa: string;
}

interface EmpresaAtiva {
  nome: string;
  cnpj: string;
  pacientes: number;
  consultas: number;
}

// Componente de KPI
interface KPIProps {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}

const KPI = ({ label, value, change, icon: Icon, color, loading }: KPIProps) => (
  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="h-6 w-6 text-white" />
    </div>
    <div className="flex-1">
      <p className="text-sm text-slate-500">{label}</p>
      {loading ? (
        <div className="h-8 w-20 bg-slate-200 animate-pulse rounded" />
      ) : (
        <>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {change !== undefined && (
            <p className={`text-xs flex items-center gap-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {change >= 0 ? '+' : ''}{change}% vs período anterior
            </p>
          )}
        </>
      )}
    </div>
  </div>
);

// Componente de Card de Relatório
interface ReportCardProps {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  children: React.ReactNode;
  loading?: boolean;
}

const ReportCard = ({ title, icon: Icon, iconColor, iconBg, children, loading }: ReportCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="card"
  >
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      </div>
    </div>
    {loading ? (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    ) : (
      children
    )}
  </motion.div>
);

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState('6meses');
  
  // Estados dos dados
  const [resumo, setResumo] = useState<ResumoStats | null>(null);
  const [consultasMes, setConsultasMes] = useState<ConsultaMes[]>([]);
  const [faturamentoMes, setFaturamentoMes] = useState<FaturamentoMes[]>([]);
  const [tiposConsulta, setTiposConsulta] = useState<TipoConsulta[]>([]);
  const [pacientesFrequentes, setPacientesFrequentes] = useState<PacienteFrequente[]>([]);
  const [empresasAtivas, setEmpresasAtivas] = useState<EmpresaAtiva[]>([]);

  // Carregar dados ao montar ou mudar período
  useEffect(() => {
    loadAllData();
  }, [periodo]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const mesesMap: Record<string, number> = {
        '30dias': 1,
        '3meses': 3,
        '6meses': 6,
        '12meses': 12
      };
      const meses = mesesMap[periodo] || 6;

      // Carregar todos os dados em paralelo
      const [
        resumoRes,
        consultasRes,
        faturamentoRes,
        tiposRes,
        pacientesRes,
        empresasRes
      ] = await Promise.all([
        api.get(`/relatorios/resumo?periodo=${periodo}`).catch(() => ({ data: null })),
        api.get(`/relatorios/consultas-por-mes?meses=${meses}`).catch(() => ({ data: [] })),
        api.get(`/relatorios/faturamento-por-mes?meses=${meses}`).catch(() => ({ data: [] })),
        api.get('/relatorios/tipos-consulta').catch(() => ({ data: [] })),
        api.get('/relatorios/pacientes-frequentes?limite=5').catch(() => ({ data: [] })),
        api.get('/relatorios/empresas-ativas?limite=5').catch(() => ({ data: [] }))
      ]);

      setResumo(resumoRes.data);
      setConsultasMes(consultasRes.data || []);
      setFaturamentoMes(faturamentoRes.data || []);
      setTiposConsulta(tiposRes.data || []);
      setPacientesFrequentes(pacientesRes.data || []);
      setEmpresasAtivas(empresasRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
      setError('Erro ao carregar dados. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    alert('Funcionalidade de exportação será implementada em breve');
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}K`;
    }
    return `R$ ${value.toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header com Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Relatórios e Análises</h2>
          <p className="text-slate-500">Visão geral do desempenho da clínica</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="select"
          >
            <option value="30dias">Últimos 30 dias</option>
            <option value="3meses">Últimos 3 meses</option>
            <option value="6meses">Últimos 6 meses</option>
            <option value="12meses">Último ano</option>
          </select>
          
          <button
            onClick={loadAllData}
            className="btn-secondary"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          
          <button onClick={handleExportPDF} className="btn-primary">
            <Download className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Alerta de erro */}
      {error && (
        <div className="alert-danger">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <KPI
            label="Total de Consultas"
            value={resumo?.totalConsultas?.toLocaleString() || '0'}
            icon={Calendar}
            color="bg-blue-500"
            loading={loading}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <KPI
            label="Média Consultas/Dia"
            value={resumo?.mediaConsultasDia || '0'}
            icon={Clock}
            color="bg-green-500"
            loading={loading}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <KPI
            label="Taxa de Retorno"
            value={`${resumo?.taxaRetorno || 0}%`}
            icon={TrendingUp}
            color="bg-purple-500"
            loading={loading}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <KPI
            label="Faturamento Total"
            value={formatCurrency(resumo?.faturamentoTotal || 0)}
            icon={DollarSign}
            color="bg-emerald-500"
            loading={loading}
          />
        </motion.div>
      </div>

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Consultas */}
        <ReportCard
          title="Consultas por Mês"
          icon={BarChart3}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
          loading={loading}
        >
          <div className="h-80">
            {consultasMes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consultasMes} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="ocupacionais" name="Ocupacionais" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="retornos" name="Retornos" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </div>
        </ReportCard>

        {/* Gráfico de Faturamento */}
        <ReportCard
          title="Faturamento Mensal"
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100"
          loading={loading}
        >
          <div className="h-80">
            {faturamentoMes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={faturamentoMes}>
                  <defs>
                    <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `R$${v/1000}K`} />
                  <Tooltip
                    formatter={(value: number) => [`R$ ${value.toLocaleString()}`, '']}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#10b981" fill="url(#colorReceitas)" strokeWidth={2} />
                  <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" fill="url(#colorDespesas)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </div>
        </ReportCard>
      </div>

      {/* Segunda linha */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tipos de Consulta */}
        <ReportCard
          title="Tipos de Consulta"
          icon={PieChart}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
          loading={loading}
        >
          <div className="h-64">
            {tiposConsulta.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={tiposConsulta}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {tiposConsulta.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value}%`, '']} />
                  <Legend verticalAlign="bottom" height={36} />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </ReportCard>

        {/* Pacientes Frequentes */}
        <ReportCard
          title="Pacientes Frequentes"
          icon={Award}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
          loading={loading}
        >
          <div className="space-y-3">
            {pacientesFrequentes.length > 0 ? (
              pacientesFrequentes.map((paciente, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="avatar-sm">{initialFrom(paciente?.nome, "P")}</div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{paciente.nome}</p>
                      <p className="text-xs text-slate-500">{paciente.empresa}</p>
                    </div>
                  </div>
                  <div className="badge-primary">{paciente.consultas} consultas</div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </ReportCard>

        {/* Empresas Ativas */}
        <ReportCard
          title="Empresas Mais Ativas"
          icon={Building2}
          iconColor="text-cyan-600"
          iconBg="bg-cyan-100"
          loading={loading}
        >
          <div className="space-y-3">
            {empresasAtivas.length > 0 ? (
              empresasAtivas.map((empresa, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{empresa.nome}</p>
                    <p className="text-xs text-slate-500">{empresa.pacientes} pacientes</p>
                  </div>
                  <div className="badge-info">{empresa.consultas} consultas</div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </ReportCard>
      </div>
    </div>
  );
}
