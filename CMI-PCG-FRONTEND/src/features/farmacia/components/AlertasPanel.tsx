/**
 * Painel de alertas do estoque farmacêutico
 *
 * Exibe alertas organizados por urgência:
 * - CRÍTICA: lotes vencidos ou estoque zerado
 * - ALTA: lotes próximos ao vencimento (< 90 dias)
 * - MÉDIA: estoque abaixo do mínimo configurado
 *
 * Estes alertas ajudam a equipe a tomar ações preventivas.
 */

import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Clock, PackageMinus, Info, CheckCircle2, Loader2 } from "lucide-react";
import type { AlertaEstoque } from "../types";

interface AlertasPanelProps {
  alertas: AlertaEstoque[];
  onClose: () => void;
  loading?: boolean;
}

const URGENCIA_ORDER = { CRITICA: 0, ALTA: 1, MEDIA: 2 } as const;

const URGENCIA_STYLE = {
  CRITICA: { border: "border-l-red-500", bg: "bg-red-50", text: "text-red-800", label: "Crítico" },
  ALTA:    { border: "border-l-orange-500", bg: "bg-orange-50", text: "text-orange-800", label: "Alto" },
  MEDIA:   { border: "border-l-yellow-500", bg: "bg-yellow-50", text: "text-yellow-800", label: "Médio" },
} as const;

const TIPO_ICON = {
  VENCIDO: AlertTriangle,
  PROXIMO_VENCER: Clock,
  ABAIXO_MINIMO: PackageMinus,
};

const TIPO_EXPLICACAO = {
  VENCIDO: "Lote expirado — deve ser descartado e não pode ser dispensado.",
  PROXIMO_VENCER: "Lote próximo ao vencimento — priorize o uso (FEFO).",
  ABAIXO_MINIMO: "Estoque abaixo do mínimo configurado — considere reabastecer.",
};

export function AlertasPanel({ alertas, onClose, loading }: AlertasPanelProps) {
  const sorted = [...alertas].sort(
    (a, b) => (URGENCIA_ORDER[a.urgencia] ?? 9) - (URGENCIA_ORDER[b.urgencia] ?? 9)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="card mb-6"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h3 className="font-bold text-secondary-900">
            Alertas do Estoque
            {alertas.length > 0 && (
              <span className="ml-2 text-sm font-normal text-secondary-500">({alertas.length})</span>
            )}
          </h3>
        </div>
        <button onClick={onClose} className="btn-icon btn-ghost" type="button">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Explicação */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4 text-xs text-blue-700">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          Alertas são gerados automaticamente pelo sistema para ajudar no controle do estoque.
          Verifique os itens críticos com prioridade e tome as ações necessárias (descarte, reposição ou dispensação prioritária).
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 text-secondary-400">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <p className="text-sm">Carregando alertas...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-secondary-400">
          <CheckCircle2 className="h-10 w-10 mb-3 text-green-400" />
          <p className="text-sm font-medium text-secondary-600">Nenhum alerta no momento</p>
          <p className="text-xs text-secondary-400 mt-1">
            O estoque está em dia — sem vencimentos críticos nem itens abaixo do mínimo.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          <AnimatePresence>
            {sorted.map((alerta, i) => {
              const style = URGENCIA_STYLE[alerta.urgencia] ?? URGENCIA_STYLE.MEDIA;
              const Icon = TIPO_ICON[alerta.tipo_alerta] ?? AlertTriangle;
              const explicacao = TIPO_EXPLICACAO[alerta.tipo_alerta] ?? "";

              return (
                <motion.div
                  key={`${alerta.medicamento_id}-${alerta.tipo_alerta}-${alerta.lote_id ?? i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-start gap-3 p-3 rounded-xl border-l-4 ${style.border} ${style.bg}`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${style.text}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${style.text}`}>{alerta.medicamento_nome}</p>
                    <p className="text-xs text-secondary-600 mt-0.5">{alerta.detalhe}</p>
                    {alerta.numero_lote && (
                      <p className="text-[11px] text-secondary-400 mt-0.5">Lote: {alerta.numero_lote}</p>
                    )}
                    <p className="text-[11px] text-secondary-400 mt-1 italic">{explicacao}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
                    {style.label}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}