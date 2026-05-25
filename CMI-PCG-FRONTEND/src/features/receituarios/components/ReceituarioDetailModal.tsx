/**
 * Modal de Detalhes do Receituário
 *
 * Exibe todos os dados do receituário, seus itens, e permite:
 * - Dispensar itens individualmente (via estoque FEFO)
 * - Baixar PDF
 * - Cancelar receituário
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileText,
  Download,
  Send,
  Ban,
  Loader2,
  User,
  UserCog,
  Gift,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { TipoReceitaBadge, StatusBadge } from "./Badges";
import type { Receituario, ReceituarioItem } from "../types";
import {
  TIPO_RECEITA_CONFIG,
  FORMA_FARMACEUTICA_LABELS,
  VIA_ADMINISTRACAO_LABELS,
} from "../types";

// =============================================================================
// Props
// =============================================================================

interface ReceituarioDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  receituario: Receituario | null;
  onDispensarItem: (receituarioId: number, itemId: number) => Promise<void>;
  onCancel: (id: number, motivo: string) => Promise<void>;
  onDownloadPdf: (id: number) => Promise<void>;
  saving: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

function dateBR(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatDateTime(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

// =============================================================================
// Componente
// =============================================================================

export function ReceituarioDetailModal({
  isOpen,
  onClose,
  receituario: rec,
  onDispensarItem,
  onCancel,
  onDownloadPdf,
  saving,
}: ReceituarioDetailModalProps) {
  const [cancelMode, setCancelMode] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [dispensingItem, setDispensingItem] = useState<number | null>(null);

  if (!isOpen || !rec) return null;

  const tipoCfg = TIPO_RECEITA_CONFIG[rec.tipo_receita];
  const statusEfetivo = rec.status_efetivo ?? rec.status;
  const isAtiva = statusEfetivo === "ATIVA";
  const itens = rec.itens ?? [];
  const totalDispensados = itens.filter((it) => it.dispensado).length;
  const progressPercent =
    itens.length > 0 ? (totalDispensados / itens.length) * 100 : 0;

  const handleDispensar = async (itemId: number) => {
    setDispensingItem(itemId);
    try {
      await onDispensarItem(rec.id, itemId);
    } finally {
      setDispensingItem(null);
    }
  };

  const handleCancel = async () => {
    if (!motivo.trim()) return;
    await onCancel(rec.id, motivo.trim());
    setCancelMode(false);
    setMotivo("");
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 sm:pt-8 px-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-bg-100 rounded-2xl shadow-2xl w-full max-w-3xl mb-8 overflow-hidden flex flex-col max-h-[95vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-bg-300 bg-bg-200/50">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`p-2.5 rounded-xl ${tipoCfg?.bg ?? "bg-secondary-100"}`}
              >
                <FileText
                  className={`h-5 w-5 ${tipoCfg?.cor ?? "text-secondary-600"}`}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-secondary-900">
                    Receita #{rec.id}
                  </h2>
                  <TipoReceitaBadge tipo={rec.tipo_receita} />
                  <StatusBadge
                    status={rec.status}
                    statusEfetivo={statusEfetivo}
                  />
                </div>
                <p className="text-xs text-secondary-500">
                  Emitida em {dateBR(rec.data_prescricao)} · Válida até{" "}
                  {dateBR(rec.data_validade)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-icon btn-ghost"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* Info cards: Paciente + Médico */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-bg-200/50 rounded-xl border border-bg-300">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-secondary-400" />
                  <span className="text-xs font-semibold text-secondary-600 uppercase tracking-wide">
                    Paciente
                  </span>
                </div>
                <p className="text-sm font-semibold text-secondary-900">
                  {rec.paciente?.nome ?? "—"}
                </p>
                <p className="text-xs text-secondary-500">
                  CPF: {rec.paciente?.cpf_formatado ?? rec.cpf_paciente}
                  {rec.paciente?.idade ? ` · ${rec.paciente.idade} anos` : ""}
                </p>
              </div>
              <div className="p-3 bg-bg-200/50 rounded-xl border border-bg-300">
                <div className="flex items-center gap-2 mb-2">
                  <UserCog className="h-4 w-4 text-secondary-400" />
                  <span className="text-xs font-semibold text-secondary-600 uppercase tracking-wide">
                    Prescritor
                  </span>
                </div>
                <p className="text-sm font-semibold text-secondary-900">
                  {rec.medico?.nome ?? "—"}
                </p>
                <p className="text-xs text-secondary-500">
                  CRM: {rec.medico?.crm ?? rec.crm_medico}
                  {rec.medico?.especialidade
                    ? ` · ${rec.medico.especialidade}`
                    : ""}
                </p>
              </div>
            </div>

            {/* Progresso de dispensação */}
            {itens.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs text-secondary-500 mb-1">
                  <span>
                    Dispensação: {totalDispensados}/{itens.length} itens
                  </span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="h-2 bg-bg-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            {/* Lista de itens */}
            <div>
              <h4 className="text-sm font-semibold text-secondary-800 mb-3 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Medicamentos prescritos ({itens.length})
              </h4>

              <div className="space-y-3">
                {itens.map((item, idx) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    index={idx}
                    isAtiva={isAtiva}
                    dispensingItem={dispensingItem}
                    onDispensar={handleDispensar}
                    saving={saving}
                  />
                ))}
              </div>
            </div>

            {/* Observações / Orientações */}
            {rec.observacoes_gerais && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-semibold text-amber-700 mb-1">
                  📝 Observações gerais
                </p>
                <p className="text-sm text-amber-800 whitespace-pre-wrap">
                  {rec.observacoes_gerais}
                </p>
              </div>
            )}
            {rec.orientacoes_paciente && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-xs font-semibold text-green-700 mb-1">
                  💡 Orientações ao paciente
                </p>
                <p className="text-sm text-green-800 whitespace-pre-wrap">
                  {rec.orientacoes_paciente}
                </p>
              </div>
            )}

            {/* Motivo de cancelamento */}
            {rec.status === "CANCELADA" && rec.motivo_cancelamento && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-xs font-semibold text-red-700 mb-1">
                  ❌ Motivo do cancelamento
                </p>
                <p className="text-sm text-red-800">
                  {rec.motivo_cancelamento}
                </p>
              </div>
            )}

            {/* Cancelamento inline */}
            {cancelMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 border-2 border-red-200 bg-red-50 rounded-xl"
              >
                <p className="text-sm font-semibold text-red-700 mb-2">
                  Cancelar este receituário?
                </p>
                <textarea
                  className="textarea border-red-200 focus:border-red-400 focus:ring-red-400"
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Motivo do cancelamento (obrigatório)"
                  autoFocus
                />
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() => {
                      setCancelMode(false);
                      setMotivo("");
                    }}
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    className="btn-primary bg-red-600 hover:bg-red-700 text-sm"
                    onClick={handleCancel}
                    disabled={!motivo.trim() || saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="h-4 w-4" />
                    )}
                    Confirmar cancelamento
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-3 p-5 sm:p-6 border-t border-bg-300 bg-bg-200/50">
            <div>
              {isAtiva && !cancelMode && (
                <button
                  type="button"
                  className="btn-ghost text-red-600 text-sm"
                  onClick={() => setCancelMode(true)}
                >
                  <Ban className="h-4 w-4" /> Cancelar receita
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => onDownloadPdf(rec.id)}
                disabled={saving}
              >
                <Download className="h-4 w-4" /> PDF
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={onClose}
              >
                Fechar
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// Sub: Card de Item
// =============================================================================

function ItemCard({
  item,
  index,
  isAtiva,
  dispensingItem,
  onDispensar,
  saving,
}: {
  item: ReceituarioItem;
  index: number;
  isAtiva: boolean;
  dispensingItem: number | null;
  onDispensar: (itemId: number) => Promise<void>;
  saving: boolean;
}) {
  const isDispensing = dispensingItem === item.id;
  const canDispensar = isAtiva && !item.dispensado && item.medicamento_id;

  return (
    <div
      className={`p-4 rounded-xl border transition-colors ${
        item.dispensado
          ? "bg-green-50/50 border-green-200"
          : "bg-bg-100 border-bg-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="text-xs font-bold text-primary-600 bg-primary-100/20 px-2 py-0.5 rounded-md mt-0.5">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-sm font-bold text-secondary-900">
                {item.nome_medicamento}
                {item.concentracao ? ` ${item.concentracao}` : ""}
              </p>
              {item.is_amostra_gratis && (
                <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium flex items-center gap-0.5">
                  <Gift className="h-3 w-3" /> Amostra
                </span>
              )}
              {item.uso_continuo && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                  ♾ Contínuo
                </span>
              )}
              {item.dispensado && (
                <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium flex items-center gap-0.5">
                  <CheckCircle2 className="h-3 w-3" /> Dispensado
                </span>
              )}
            </div>

            {item.principio_ativo && (
              <p className="text-xs text-secondary-500 italic mb-1">
                {item.principio_ativo}
              </p>
            )}

            <p className="text-sm text-secondary-700 whitespace-pre-wrap mb-1">
              {item.posologia}
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-secondary-400">
              {item.forma_farmaceutica && (
                <span>
                  {FORMA_FARMACEUTICA_LABELS[item.forma_farmaceutica] ??
                    item.forma_farmaceutica}
                </span>
              )}
              {item.via_administracao && (
                <span>
                  {VIA_ADMINISTRACAO_LABELS[item.via_administracao] ??
                    item.via_administracao}
                </span>
              )}
              {item.quantidade && (
                <span>
                  Qtd: {item.quantidade} {item.unidade_quantidade ?? ""}
                </span>
              )}
              {item.duracao_dias && (
                <span>Duração: {item.duracao_dias} dias</span>
              )}
            </div>

            {item.dispensado && item.dispensado_em && (
              <p className="text-[11px] text-green-600 mt-1">
                Dispensado em {formatDateTime(item.dispensado_em)}
                {item.dispensado_quantidade
                  ? ` · ${item.dispensado_quantidade} un`
                  : ""}
              </p>
            )}

            {item.observacoes && (
              <p className="text-[11px] text-secondary-400 mt-1 italic">
                💬 {item.observacoes}
              </p>
            )}
          </div>
        </div>

        {/* Ação dispensar */}
        {canDispensar && (
          <button
            type="button"
            onClick={() => onDispensar(item.id)}
            disabled={saving || isDispensing}
            className="btn-secondary text-xs whitespace-nowrap flex-shrink-0"
            title="Dispensar do estoque da farmácia (FEFO)"
          >
            {isDispensing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Dispensar
          </button>
        )}
      </div>
    </div>
  );
}
