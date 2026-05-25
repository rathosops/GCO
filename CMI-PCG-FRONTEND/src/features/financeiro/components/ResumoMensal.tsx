// src/features/financeiro/components/ResumoMensal.tsx
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, BadgeDollarSign, BarChart3, Loader2 } from 'lucide-react';

interface ResumoMensalData {
  total_bruto: number;
  total_descontos: number;
  total_liquido: number;
  por_tipo: { tipo: string; total: number }[];
  por_origem: { origem: string; total: number }[];
  mes: number;
  ano: number;
}

interface ResumoMensalProps {
  resumo: ResumoMensalData | null;
  loading: boolean;
}

function moneyBR(value: number): string {
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return `R$ ${Number(value || 0).toFixed(2)}`;
  }
}

export default function ResumoMensal({ resumo, loading }: ResumoMensalProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Receita Bruta */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-success-light rounded-xl">
            <TrendingUp className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-sm text-secondary-500">Receita bruta (mês)</p>
            <p className="text-2xl font-bold text-success">
              {loading ? '...' : moneyBR(resumo?.total_bruto ?? 0)}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Descontos */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-danger-light rounded-xl">
            <TrendingDown className="h-6 w-6 text-danger" />
          </div>
          <div>
            <p className="text-sm text-secondary-500">Descontos (mês)</p>
            <p className="text-2xl font-bold text-danger">
              {loading ? '...' : moneyBR(resumo?.total_descontos ?? 0)}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Receita Líquida */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary-100 rounded-xl">
            <BadgeDollarSign className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-secondary-500">Receita líquida (mês)</p>
            <p className="text-2xl font-bold text-primary-600">
              {loading ? '...' : moneyBR(resumo?.total_liquido ?? 0)}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Componente separado para gráficos simples
export function ResumoGraficos({ resumo, loading }: ResumoMensalProps) {
  const miniBars = (items: { label: string; value: number }[]) => {
    const max = Math.max(1, ...items.map((i) => i.value));
    return (
      <div className="space-y-2">
        {items.map((i) => {
          const pct = Math.max(0, Math.min(100, (i.value / max) * 100));
          return (
            <div key={i.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm text-secondary-700">
                <span className="font-medium truncate">{i.label}</span>
                <span className="text-secondary-600">{moneyBR(i.value)}</span>
              </div>
              <div className="h-2 w-full bg-secondary-100 rounded-full overflow-hidden">
                <div className="h-2 bg-primary-600" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Por tipo */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-bold text-secondary-900">Distribuição por tipo (mês)</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </div>
        ) : resumo?.por_tipo?.length ? (
          miniBars(resumo.por_tipo.map((x) => ({ label: x.tipo, value: x.total })))
        ) : (
          <p className="text-sm text-secondary-500">Sem dados.</p>
        )}
      </div>

      {/* Por origem */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-bold text-secondary-900">Distribuição por origem (mês)</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </div>
        ) : resumo?.por_origem?.length ? (
          miniBars(resumo.por_origem.map((x) => ({ label: x.origem, value: x.total })))
        ) : (
          <p className="text-sm text-secondary-500">Sem dados.</p>
        )}
      </div>
    </div>
  );
}