// src/features/financeiro/components/DespesasDRE.tsx
import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  BadgeDollarSign,
  AlertTriangle,
  Clock,
  BarChart3,
} from 'lucide-react';
import { despesasAnalyticsAPI } from '@/services/despesas.api';
import type { DespesaDRE, DespesaUpcoming } from '@/types/despesas.types';
import { CATEGORIA_LABELS } from '@/types/despesas.types';
import { formatCurrencyBRL } from '@/utils/formatters';

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function DespesasDRE() {
  const [dre, setDre] = useState<DespesaDRE | null>(null);
  const [upcoming, setUpcoming] = useState<DespesaUpcoming | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return { inicio: `${y}-${m}-01`, fim: now.toISOString().split('T')[0] };
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dreRes, upRes] = await Promise.all([
        despesasAnalyticsAPI.getDRE({ data_inicio: periodo.inicio, data_fim: periodo.fim }),
        despesasAnalyticsAPI.getUpcoming({ dias: 30 }),
      ]);
      setDre(dreRes);
      setUpcoming(upRes);
    } catch (e) {
      console.error('Erro ao carregar DRE:', e);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  const r = dre?.resultado;
  const isPositive = (r?.operacional ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Filtro de período */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-bold text-secondary-900">DRE Simplificado</h3>
          </div>
          <div className="flex gap-3 ml-auto">
            <div>
              <label className="label text-xs">De</label>
              <input
                type="date"
                value={periodo.inicio}
                onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="label text-xs">Até</label>
              <input
                type="date"
                value={periodo.fim}
                onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))}
                className="input text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {dre && (
        <>
          {/* KPIs DRE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-green-100 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-secondary-500">Receita líquida</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrencyBRL(dre.receitas.liquida)}</p>
                  {dre.receitas.descontos > 0 && (
                    <p className="text-xs text-secondary-400">Desc: {formatCurrencyBRL(dre.receitas.descontos)}</p>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="card">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-100 rounded-xl">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-secondary-500">Despesas total</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrencyBRL(dre.despesas.total)}</p>
                  <p className="text-xs text-secondary-400">
                    Fixo: {formatCurrencyBRL(dre.despesas.fixa)} | Var: {formatCurrencyBRL(dre.despesas.variavel)}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="card">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isPositive ? 'bg-primary-100' : 'bg-red-100'}`}>
                  <BadgeDollarSign className={`h-5 w-5 ${isPositive ? 'text-primary-600' : 'text-red-600'}`} />
                </div>
                <div>
                  <p className="text-xs text-secondary-500">Resultado operacional</p>
                  <p className={`text-xl font-bold ${isPositive ? 'text-primary-600' : 'text-red-600'}`}>
                    {formatCurrencyBRL(r?.operacional)}
                  </p>
                  <p className="text-xs text-secondary-400">
                    Margem: {r?.margem_operacional_pct ?? 0}%
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Despesas por categoria */}
          {dre.despesas.por_categoria.length > 0 && (
            <div className="card space-y-4">
              <h4 className="text-base font-bold text-secondary-900">Despesas por categoria</h4>
              <div className="space-y-3">
                {dre.despesas.por_categoria.map((c) => {
                  const label = CATEGORIA_LABELS[c.categoria as keyof typeof CATEGORIA_LABELS] || c.categoria;
                  const pct = Math.max(0, Math.min(100, c.percentual));
                  return (
                    <div key={c.categoria} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-secondary-700">{label}</span>
                        <span className="text-secondary-600">
                          {formatCurrencyBRL(c.total)} ({c.percentual.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-secondary-100 rounded-full overflow-hidden">
                        <div className="h-2 bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Contas a pagar */}
      {upcoming && (upcoming.quantidade_atrasadas > 0 || upcoming.quantidade_proximas > 0) && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <h4 className="text-base font-bold text-secondary-900">Contas a pagar (próx. 30 dias)</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-xl bg-red-50">
              <p className="text-red-600 font-medium">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                {upcoming.quantidade_atrasadas} atrasada(s)
              </p>
              <p className="text-red-700 font-bold">{formatCurrencyBRL(upcoming.total_atrasado)}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50">
              <p className="text-amber-600 font-medium">
                <Clock className="h-4 w-4 inline mr-1" />
                {upcoming.quantidade_proximas} a vencer
              </p>
              <p className="text-amber-700 font-bold">{formatCurrencyBRL(upcoming.total_proximo)}</p>
            </div>
            <div className="p-3 rounded-xl bg-secondary-50">
              <p className="text-secondary-600 font-medium">Total</p>
              <p className="text-secondary-900 font-bold">{formatCurrencyBRL(upcoming.total_geral)}</p>
            </div>
          </div>

          {/* Lista das atrasadas */}
          {upcoming.atrasadas.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-600 mb-2">Atrasadas:</p>
              <div className="space-y-1">
                {upcoming.atrasadas.slice(0, 5).map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-red-50/50">
                    <span className="truncate text-secondary-700">{d.descricao}</span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-secondary-500">Venc: {formatDateBR(d.data_vencimento)}</span>
                      <span className="font-medium text-red-700">{formatCurrencyBRL(d.valor)}</span>
                    </div>
                  </div>
                ))}
                {upcoming.atrasadas.length > 5 && (
                  <p className="text-xs text-secondary-500 text-center">
                    + {upcoming.atrasadas.length - 5} mais...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
