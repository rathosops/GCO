/**
 * Modal para criar/editar medicamento no catálogo
 *
 * O catálogo de medicamentos é a base do controle de estoque.
 * Cada medicamento pode ter múltiplos lotes (com validades diferentes).
 *
 * Classificação ANVISA define se o medicamento é controlado:
 * - LIVRE / SOB_PRESCRICAO: venda sem receita especial
 * - A1, A2, B1, B2, C1–C5: controlados (exigem CRM na dispensação)
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pill, Loader2, ShieldAlert, Info } from "lucide-react";
import type { Medicamento, MedicamentoFormData, ClassificacaoANVISA } from "../types";
import { CLASSIFICACAO_LABELS, FORMAS_FARMACEUTICAS_LABELS } from "../types";

interface MedicamentoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MedicamentoFormData) => Promise<void>;
  initialData?: Medicamento | null;
  saving: boolean;
}

const UNIDADES = [
  { v: "UN", l: "Unidade (UN)" }, { v: "CP", l: "Comprimido (CP)" }, { v: "CAP", l: "Cápsula (CAP)" },
  { v: "ML", l: "Mililitro (ML)" }, { v: "MG", l: "Miligrama (MG)" }, { v: "G", l: "Grama (G)" },
  { v: "AMP", l: "Ampola (AMP)" }, { v: "FR", l: "Frasco (FR)" }, { v: "BIS", l: "Bisnaga (BIS)" },
  { v: "CX", l: "Caixa (CX)" }, { v: "ENV", l: "Envelope (ENV)" },
];

const EMPTY: MedicamentoFormData = {
  nome_comercial: "", principio_ativo: "", apresentacao: "", forma_farmaceutica: "",
  unidade_medida: "UN", concentracao: "", classificacao_anvisa: "LIVRE", registro_anvisa: "",
  fabricante: "", estoque_minimo: 5, estoque_maximo: 100, observacoes: "",
};

export function MedicamentoFormModal({ isOpen, onClose, onSubmit, initialData, saving }: MedicamentoFormModalProps) {
  const [form, setForm] = useState<MedicamentoFormData>(EMPTY);
  const isEdit = !!initialData;

  useEffect(() => {
    if (initialData) {
      setForm({
        nome_comercial: initialData.nome_comercial, principio_ativo: initialData.principio_ativo,
        apresentacao: initialData.apresentacao ?? "", forma_farmaceutica: initialData.forma_farmaceutica ?? "",
        unidade_medida: initialData.unidade_medida ?? "UN", concentracao: initialData.concentracao ?? "",
        classificacao_anvisa: initialData.classificacao_anvisa ?? "LIVRE",
        registro_anvisa: initialData.registro_anvisa ?? "", fabricante: initialData.fabricante ?? "",
        estoque_minimo: initialData.estoque_minimo ?? 5, estoque_maximo: initialData.estoque_maximo ?? 100,
        observacoes: initialData.observacoes ?? "",
      });
    } else { setForm(EMPTY); }
  }, [initialData, isOpen]);

  const set = <K extends keyof MedicamentoFormData>(k: K, v: MedicamentoFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const isControlado = form.classificacao_anvisa
    ? !["LIVRE", "SOB_PRESCRICAO"].includes(form.classificacao_anvisa) : false;

  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); await onSubmit(form); };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 sm:pt-8 px-4 overflow-y-auto"
        onClick={onClose}>
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-bg-100 rounded-2xl shadow-2xl w-full max-w-4xl mb-8 overflow-hidden flex flex-col max-h-[95vh]">

          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-bg-300 bg-bg-200/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-100 rounded-xl"><Pill className="h-5 w-5 text-teal-600" /></div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-secondary-900">{isEdit ? "Editar Medicamento" : "Novo Medicamento"}</h2>
                <p className="text-xs text-secondary-500">Cadastro no catálogo de medicamentos da farmácia</p>
              </div>
            </div>
            <button onClick={onClose} className="btn-icon btn-ghost" type="button"><X className="h-5 w-5" /></button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="space-y-6">

              {/* Identificação */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">Identificação</h4>
                <p className="text-xs text-secondary-400 mb-4">
                  Dados que identificam o medicamento. O nome comercial é como aparece na embalagem;
                  o princípio ativo é a substância farmacológica.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nome comercial *</label>
                    <input className="input" value={form.nome_comercial} onChange={(e) => set("nome_comercial", e.target.value)}
                      placeholder="Ex: Dipirona Sódica" required />
                    <p className="text-[11px] text-secondary-400 mt-1">Nome que aparece na embalagem do produto</p>
                  </div>
                  <div>
                    <label className="label">Princípio ativo *</label>
                    <input className="input" value={form.principio_ativo} onChange={(e) => set("principio_ativo", e.target.value)}
                      placeholder="Ex: Metamizol sódico" required />
                    <p className="text-[11px] text-secondary-400 mt-1">Substância responsável pelo efeito terapêutico</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="label">Apresentação</label>
                    <input className="input" value={form.apresentacao} onChange={(e) => set("apresentacao", e.target.value)}
                      placeholder="Ex: Caixa com 20 comprimidos" />
                    <p className="text-[11px] text-secondary-400 mt-1">Como o produto é vendido</p>
                  </div>
                  <div>
                    <label className="label">Concentração</label>
                    <input className="input" value={form.concentracao} onChange={(e) => set("concentracao", e.target.value)}
                      placeholder="Ex: 500mg" />
                  </div>
                  <div>
                    <label className="label">Fabricante</label>
                    <input className="input" value={form.fabricante} onChange={(e) => set("fabricante", e.target.value)}
                      placeholder="Laboratório fabricante" />
                  </div>
                </div>
              </section>

              {/* Forma e unidade */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">Forma farmacêutica e unidade</h4>
                <p className="text-xs text-secondary-400 mb-4">
                  A forma farmacêutica indica como o medicamento é apresentado (comprimido, cápsula, solução etc.).
                  A unidade de medida define como o estoque é contabilizado.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Forma farmacêutica</label>
                    <select className="select" value={form.forma_farmaceutica} onChange={(e) => set("forma_farmaceutica", e.target.value)}>
                      <option value="">Selecione...</option>
                      {Object.entries(FORMAS_FARMACEUTICAS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Unidade de medida</label>
                    <select className="select" value={form.unidade_medida} onChange={(e) => set("unidade_medida", e.target.value)}>
                      {UNIDADES.map((u) => <option key={u.v} value={u.v}>{u.l}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* Classificação ANVISA */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">Classificação ANVISA</h4>
                <p className="text-xs text-secondary-400 mb-4">
                  A classificação define o nível de controle exigido pela ANVISA.
                  Medicamentos controlados (A1, B1, C1 etc.) exigem CRM do prescritor no momento da dispensação.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Classificação *</label>
                    <select className="select" value={form.classificacao_anvisa} onChange={(e) => set("classificacao_anvisa", e.target.value as ClassificacaoANVISA)}>
                      {Object.entries(CLASSIFICACAO_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Registro ANVISA</label>
                    <input className="input" value={form.registro_anvisa} onChange={(e) => set("registro_anvisa", e.target.value)}
                      placeholder="Nº de registro (opcional)" />
                    <p className="text-[11px] text-secondary-400 mt-1">Número do registro na ANVISA, se disponível</p>
                  </div>
                </div>

                {isControlado && (
                  <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl mt-4 text-xs text-red-700">
                    <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Medicamento controlado.</strong> A dispensação deste medicamento exigirá o CRM do médico prescritor,
                      conforme Portaria SVS/MS 344/1998. Certifique-se de que a classificação está correta.
                    </div>
                  </div>
                )}
              </section>

              {/* Limites de estoque */}
              <section>
                <h4 className="text-base font-semibold text-secondary-800 mb-1">Limites de estoque</h4>
                <p className="text-xs text-secondary-400 mb-4">
                  O sistema gera alertas quando o estoque fica abaixo do mínimo (alerta de reposição)
                  ou acima do máximo (possível superestocagem). Ajuste conforme a demanda da clínica.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Estoque mínimo</label>
                    <input className="input" type="number" min={0} value={form.estoque_minimo}
                      onChange={(e) => set("estoque_minimo", Number(e.target.value))} />
                    <p className="text-[11px] text-secondary-400 mt-1">Abaixo desse valor, o sistema gera alerta de reposição</p>
                  </div>
                  <div>
                    <label className="label">Estoque máximo</label>
                    <input className="input" type="number" min={0} value={form.estoque_maximo}
                      onChange={(e) => set("estoque_maximo", Number(e.target.value))} />
                    <p className="text-[11px] text-secondary-400 mt-1">Limite superior para evitar superestocagem</p>
                  </div>
                </div>
              </section>

              {/* Observações */}
              <section>
                <label className="label">Observações</label>
                <textarea className="textarea" rows={3} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)}
                  placeholder="Informações adicionais, contraindicações, restrições de armazenamento..." />
              </section>
            </div>
          </form>

          {/* Footer */}
          <div className="flex gap-3 p-5 sm:p-6 border-t border-bg-300 bg-bg-200/50">
            <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={saving}>Cancelar</button>
            <button type="submit" onClick={handleSubmit} className="btn-primary flex-1" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Salvar alterações" : "Cadastrar medicamento"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}