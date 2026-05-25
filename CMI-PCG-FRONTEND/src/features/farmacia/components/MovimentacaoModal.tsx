/**
 * Modal de movimentação de estoque
 *
 * Suporta 3 modos:
 * - ENTRADA: adicionar estoque a um lote existente
 * - AJUSTE: corrigir inventário (+/−)
 * - DESCARTE: registrar descarte com motivo
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, PackagePlus, ClipboardEdit, Trash2 } from "lucide-react";
import type { Lote, MotivoDescarte } from "../types";
import { MOTIVO_DESCARTE_LABELS } from "../types";

export type MovimentacaoTipo = "ENTRADA" | "AJUSTE" | "DESCARTE";

interface MovimentacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  tipo: MovimentacaoTipo;
  lote: Lote | null;
  medicamentoNome?: string;
  saving: boolean;
  onEntrada?: (loteId: number, quantidade: number, obs?: string) => Promise<void>;
  onAjuste?: (loteId: number, quantidade: number, positivo: boolean, obs?: string) => Promise<void>;
  onDescarte?: (loteId: number, quantidade: number, motivo: MotivoDescarte, obs?: string) => Promise<void>;
}

const TIPO_CONFIG = {
  ENTRADA: { icon: PackagePlus, color: "bg-green-100", iconColor: "text-green-600", title: "Registrar Entrada" },
  AJUSTE: { icon: ClipboardEdit, color: "bg-amber-100", iconColor: "text-amber-600", title: "Ajuste de Inventário" },
  DESCARTE: { icon: Trash2, color: "bg-red-100", iconColor: "text-red-600", title: "Registrar Descarte" },
};

export function MovimentacaoModal({
  isOpen,
  onClose,
  tipo,
  lote,
  medicamentoNome,
  saving,
  onEntrada,
  onAjuste,
  onDescarte,
}: MovimentacaoModalProps) {
  const [quantidade, setQuantidade] = useState(1);
  const [positivo, setPositivo] = useState(true);
  const [motivo, setMotivo] = useState<MotivoDescarte>("VENCIDO");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (isOpen) {
      setQuantidade(1);
      setPositivo(true);
      setMotivo("VENCIDO");
      setObservacoes("");
    }
  }, [isOpen]);

  const config = TIPO_CONFIG[tipo];
  const Icon = config.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lote) return;

    switch (tipo) {
      case "ENTRADA":
        await onEntrada?.(lote.id, quantidade, observacoes || undefined);
        break;
      case "AJUSTE":
        await onAjuste?.(lote.id, quantidade, positivo, observacoes || undefined);
        break;
      case "DESCARTE":
        await onDescarte?.(lote.id, quantidade, motivo, observacoes || undefined);
        break;
    }
  };

  if (!isOpen || !lote) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="card w-full max-w-md mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 ${config.color} rounded-xl`}>
                <Icon className={`h-5 w-5 ${config.iconColor}`} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-secondary-900">{config.title}</h2>
                <p className="text-xs text-secondary-500 truncate max-w-[250px]">
                  {medicamentoNome} — Lote {lote.numero_lote}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="btn-icon btn-ghost" type="button">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Info do lote */}
          <div className="p-3 bg-bg-200 rounded-xl mb-4 text-sm text-secondary-600 space-y-1">
            <p>Estoque atual: <strong className="text-secondary-900">{lote.quantidade_atual}</strong> unidades</p>
            <p>Validade: <strong className="text-secondary-900">{lote.data_validade_br ?? lote.data_validade}</strong></p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Quantidade */}
            <div>
              <label className="label">Quantidade *</label>
              <input
                className="input"
                type="number"
                min={1}
                max={tipo !== "ENTRADA" ? lote.quantidade_atual : undefined}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                required
                autoFocus
              />
            </div>

            {/* Ajuste: direção */}
            {tipo === "AJUSTE" && (
              <div>
                <label className="label">Tipo de ajuste</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPositivo(true)}
                    className={`p-3 rounded-xl border-2 text-center text-sm font-medium transition-all ${
                      positivo
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-bg-300 text-secondary-500 hover:bg-bg-200"
                    }`}
                  >
                    + Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPositivo(false)}
                    className={`p-3 rounded-xl border-2 text-center text-sm font-medium transition-all ${
                      !positivo
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-bg-300 text-secondary-500 hover:bg-bg-200"
                    }`}
                  >
                    − Remover
                  </button>
                </div>
              </div>
            )}

            {/* Descarte: motivo */}
            {tipo === "DESCARTE" && (
              <div>
                <label className="label">Motivo do descarte *</label>
                <select
                  className="select"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value as MotivoDescarte)}
                  required
                >
                  {Object.entries(MOTIVO_DESCARTE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Observações */}
            <div>
              <label className="label">Observações</label>
              <textarea
                className="textarea"
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Justificativa ou detalhes..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirmar
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}