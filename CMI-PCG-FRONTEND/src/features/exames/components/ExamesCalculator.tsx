/**
 * Calculadora de orçamento de exames
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calculator, Percent, Trash2, FileText, Printer } from 'lucide-react';
import type { Exame } from '../types';
import { n } from '../types';

interface ExamesCalculatorProps {
  exames: Exame[];
  desconto: number;
  descontoPercentual: number;
  onDescontoChange: (valor: number) => void;
  onDescontoPercentualChange: (valor: number) => void;
  onRemove: (exame: Exame) => void;
  onClear: () => void;
  onGerarSolicitacao?: () => void;
  onImprimir?: () => void;
}

export function ExamesCalculator({
  exames,
  desconto,
  descontoPercentual,
  onDescontoChange,
  onDescontoPercentualChange,
  onRemove,
  onClear,
  onGerarSolicitacao,
  onImprimir,
}: ExamesCalculatorProps) {
  const totais = useMemo(() => {
    const totalCmi = exames.reduce((a, e) => a + n(e.valor_cmi), 0);
    const totalVenda = exames.reduce((a, e) => a + n(e.valor_venda), 0);

    const descontoCalc =
      descontoPercentual > 0 ? totalVenda * (descontoPercentual / 100) : desconto;

    const totalFinal = Math.max(0, totalVenda - descontoCalc);
    const margemBruta = totalFinal - totalCmi;
    const margemPct = totalCmi > 0 ? (margemBruta / totalCmi) * 100 : 0;

    return { totalCmi, totalVenda, desconto: descontoCalc, totalFinal, margemBruta, margemPct };
  }, [exames, desconto, descontoPercentual]);

  if (exames.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="card border-2 border-primary-100/30"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Calculator className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-text-100 text-sm">Orçamento</h3>
            <p className="text-xs text-text-200">
              {exames.length} exame{exames.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={onClear} className="btn-ghost btn-sm text-red-500">
          <Trash2 className="h-3.5 w-3.5" />
          Limpar
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto mb-4">
        <AnimatePresence>
          {exames.map((exame) => (
            <motion.div
              key={exame.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center justify-between p-2.5 bg-bg-200 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-100 truncate">{exame.nome}</p>
                <p className="text-[11px] text-text-200">{exame.tipo}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-100 tabular-nums">
                  R$ {n(exame.valor_venda).toFixed(2)}
                </span>
                <button
                  onClick={() => onRemove(exame)}
                  className="p-1 text-text-200 hover:text-red-500 rounded transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Desconto */}
      <div className="bg-bg-200 rounded-lg p-3 mb-4">
        <label className="text-xs font-medium text-text-200 mb-2 block">Desconto</label>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="input py-1.5 pr-8 text-sm"
              value={descontoPercentual || ''}
              onChange={(e) => {
                onDescontoPercentualChange(parseFloat(e.target.value) || 0);
                onDescontoChange(0);
              }}
              placeholder="0"
            />
            <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-200" />
          </div>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-200 text-xs">R$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input py-1.5 pl-8 text-sm"
              value={descontoPercentual > 0 ? '' : desconto || ''}
              onChange={(e) => {
                onDescontoChange(parseFloat(e.target.value) || 0);
                onDescontoPercentualChange(0);
              }}
              placeholder="0,00"
              disabled={descontoPercentual > 0}
            />
          </div>
        </div>
      </div>

      {/* Totais */}
      <div className="space-y-1.5 mb-4 text-sm">
        <div className="flex justify-between text-text-200">
          <span>Subtotal:</span>
          <span className="tabular-nums">R$ {totais.totalVenda.toFixed(2)}</span>
        </div>
        {totais.desconto > 0 && (
          <div className="flex justify-between text-red-500">
            <span>Desconto:</span>
            <span className="tabular-nums">- R$ {totais.desconto.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg pt-2 border-t border-bg-300">
          <span className="text-text-100">Total:</span>
          <span className="text-primary-100 tabular-nums">R$ {totais.totalFinal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs text-text-200">
          <span>Custo: R$ {totais.totalCmi.toFixed(2)}</span>
          <span className={totais.margemBruta >= 0 ? 'text-emerald-600' : 'text-red-500'}>
            Margem: {totais.margemPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-2">
        {onGerarSolicitacao && (
          <button onClick={onGerarSolicitacao} className="btn-primary flex-1">
            <FileText className="h-4 w-4" />
            Gerar Solicitação
          </button>
        )}
        {onImprimir && (
          <button onClick={onImprimir} className="btn-secondary">
            <Printer className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}