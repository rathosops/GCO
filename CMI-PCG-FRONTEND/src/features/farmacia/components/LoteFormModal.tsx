/**
 * Modal para cadastrar novo lote de medicamento
 *
 * Cada medicamento pode ter múltiplos lotes (entradas diferentes).
 * Cada lote tem: número do lote, validade, quantidade e fornecedor.
 * O sistema de semáforo (VERDE/LARANJA/VERMELHO/VENCIDO) é calculado
 * automaticamente a partir da data de validade.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package, Loader2, Info } from "lucide-react";
import type { Medicamento, LoteFormData } from "../types";
import { fornecedoresAPI } from "../api";

interface LoteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LoteFormData) => Promise<void>;
  medicamento: Medicamento | null;
  saving: boolean;
}

interface FornSimple { id: number; nome: string; }

const EMPTY: LoteFormData = {
  numero_lote: "", codigo_barras: "", data_validade: "", data_fabricacao: "",
  quantidade_inicial: 1, preco_unitario: undefined, fornecedor_id: undefined,
  nota_fiscal_entrada: "", localizacao: "",
};

export function LoteFormModal({ isOpen, onClose, onSubmit, medicamento, saving }: LoteFormModalProps) {
  const [form, setForm] = useState<LoteFormData>(EMPTY);
  const [fornecedores, setFornecedores] = useState<FornSimple[]>([]);
  const [fornLoading, setFornLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY);
      loadFornecedores();
    }
  }, [isOpen]);

  const loadFornecedores = async () => {
    try {
      setFornLoading(true);
      const data = await fornecedoresAPI.list({ ativo: true, limit: 200 });
      setFornecedores(Array.isArray(data) ? data.map((f) => ({ id: f.id, nome: f.nome })) : []);
    } catch { setFornecedores([]); }
    finally { setFornLoading(false); }
  };

  const set = <K extends keyof LoteFormData>(k: K, v: LoteFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); await onSubmit(form); };

  if (!isOpen || !medicamento) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 sm:pt-8 px-4 overflow-y-auto"
        onClick={onClose}>
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-bg-100 rounded-2xl shadow-2xl w-full max-w-3xl mb-8 overflow-hidden flex flex-col max-h-[95vh]">

          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-bg-300 bg-bg-200/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 rounded-xl"><Package className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-secondary-900">Novo Lote</h2>
                <p className="text-xs text-secondary-500 truncate max-w-xs">
                  {medicamento.nome_comercial}{medicamento.concentracao ? ` · ${medicamento.concentracao}` : ""}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="btn-icon btn-ghost" type="button"><X className="h-5 w-5" /></button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="space-y-6">

              {/* Explainer */}
              <div className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>O que é um lote?</strong> Cada entrada de medicamento no estoque é registrada como um lote,
                  com sua própria validade, quantidade e rastreabilidade. Isso permite o controle FEFO
                  (First Expired, First Out) e garante a segurança do paciente.
                </div>
              </div>

              {/* Identificação do lote */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">Identificação do lote</h4>
                <p className="text-xs text-secondary-400 mb-4">Informações impressas na embalagem do medicamento.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Número do lote *</label>
                    <input className="input" value={form.numero_lote} onChange={(e) => set("numero_lote", e.target.value)}
                      placeholder="Ex: LOT2024-001A" required />
                    <p className="text-[11px] text-secondary-400 mt-1">Impresso na embalagem pelo fabricante</p>
                  </div>
                  <div>
                    <label className="label">Código de barras (EAN)</label>
                    <input className="input" value={form.codigo_barras} onChange={(e) => set("codigo_barras", e.target.value)}
                      placeholder="7891234567890" maxLength={14} />
                    <p className="text-[11px] text-secondary-400 mt-1">EAN-13 do produto (opcional)</p>
                  </div>
                </div>
              </section>

              {/* Validade */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">Validade e fabricação</h4>
                <p className="text-xs text-secondary-400 mb-4">
                  A data de validade alimenta o semáforo: 🟢 {">"}180d, 🟠 90–180d, 🔴 {"<"}90d, ⛔ vencido.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Data de validade *</label>
                    <input className="input" type="date" value={form.data_validade}
                      onChange={(e) => set("data_validade", e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Data de fabricação</label>
                    <input className="input" type="date" value={form.data_fabricacao}
                      onChange={(e) => set("data_fabricacao", e.target.value)} />
                  </div>
                </div>
              </section>

              {/* Quantidade e preço */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">Quantidade e custo</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Quantidade inicial *</label>
                    <input className="input" type="number" min={1} value={form.quantidade_inicial}
                      onChange={(e) => set("quantidade_inicial", Number(e.target.value))} required />
                    <p className="text-[11px] text-secondary-400 mt-1">Unidades recebidas neste lote</p>
                  </div>
                  <div>
                    <label className="label">Preço unitário (R$)</label>
                    <input className="input" type="number" min={0} step={0.01}
                      value={form.preco_unitario ?? ""} onChange={(e) => set("preco_unitario", e.target.value ? Number(e.target.value) : undefined)} />
                    <p className="text-[11px] text-secondary-400 mt-1">Custo por unidade para controle financeiro</p>
                  </div>
                </div>
              </section>

              {/* Fornecedor e NF */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">Origem</h4>
                <p className="text-xs text-secondary-400 mb-4">Fornecedor e nota fiscal da entrada.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Fornecedor</label>
                    <select className="select" value={form.fornecedor_id ?? ""}
                      onChange={(e) => set("fornecedor_id", e.target.value ? Number(e.target.value) : undefined)}>
                      <option value="">{fornLoading ? "Carregando..." : "Selecione..."}</option>
                      {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                    {fornecedores.length === 0 && !fornLoading && (
                      <p className="text-[11px] text-amber-600 mt-1">Nenhum fornecedor cadastrado. Cadastre um na aba "Fornecedores".</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Nota fiscal</label>
                    <input className="input" value={form.nota_fiscal_entrada}
                      onChange={(e) => set("nota_fiscal_entrada", e.target.value)} placeholder="Nº da NF de entrada" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="label">Localização física</label>
                  <input className="input" value={form.localizacao}
                    onChange={(e) => set("localizacao", e.target.value)} placeholder="Ex: Armário 3, Prateleira B" />
                  <p className="text-[11px] text-secondary-400 mt-1">Onde o lote está armazenado fisicamente</p>
                </div>
              </section>
            </div>
          </form>

          {/* Footer */}
          <div className="flex gap-3 p-5 sm:p-6 border-t border-bg-300 bg-bg-200/50">
            <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={saving}>Cancelar</button>
            <button type="submit" onClick={handleSubmit} className="btn-primary flex-1" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Cadastrar lote
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}