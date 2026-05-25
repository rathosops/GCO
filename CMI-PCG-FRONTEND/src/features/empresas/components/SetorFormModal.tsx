/**
 * Modal de criação/edição de setor
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layers, X, Loader2, Plus, Trash2 } from "lucide-react";
import type { Setor, SetorFormData, RiscosOcupacionais } from "../types";
import { CATEGORIAS_RISCO, INITIAL_SETOR_FORM } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SetorFormData) => Promise<void>;
  initialData?: Setor | null;
  saving: boolean;
}

export function SetorFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  saving,
}: Props) {
  const isEdit = !!initialData;
  const [form, setForm] = useState<SetorFormData>(INITIAL_SETOR_FORM);
  const [newRisco, setNewRisco] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setForm({
        nome: initialData.nome,
        descricao: initialData.descricao || "",
        riscos_ocupacionais: { ...initialData.riscos_ocupacionais },
      });
    } else {
      setForm({ ...INITIAL_SETOR_FORM, riscos_ocupacionais: {} });
    }
    setNewRisco({});
  }, [isOpen, initialData]);

  const addRisco = (cat: keyof RiscosOcupacionais) => {
    const val = newRisco[cat]?.trim();
    if (!val) return;
    setForm((p) => ({
      ...p,
      riscos_ocupacionais: {
        ...p.riscos_ocupacionais,
        [cat]: [...(p.riscos_ocupacionais[cat] || []), val],
      },
    }));
    setNewRisco((p) => ({ ...p, [cat]: "" }));
  };

  const removeRisco = (cat: keyof RiscosOcupacionais, idx: number) => {
    setForm((p) => ({
      ...p,
      riscos_ocupacionais: {
        ...p.riscos_ocupacionais,
        [cat]: (p.riscos_ocupacionais[cat] || []).filter((_, i) => i !== idx),
      },
    }));
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.nome.trim()) return;
    await onSubmit(form);
  };

  if (!isOpen) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="card w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-xl">
                <Layers className="h-5 w-5 text-violet-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {isEdit ? "Editar Setor" : "Novo Setor"}
              </h3>
            </div>
            <button onClick={onClose} className="btn-icon btn-ghost">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nome do Setor *</label>
              <input
                className="input"
                value={form.nome}
                onChange={(e) =>
                  setForm((p) => ({ ...p, nome: e.target.value }))
                }
                placeholder="Ex: Produção, Administrativo, Manutenção..."
              />
            </div>

            <div>
              <label className="label">Descrição</label>
              <textarea
                className="input min-h-[60px]"
                value={form.descricao}
                onChange={(e) =>
                  setForm((p) => ({ ...p, descricao: e.target.value }))
                }
                placeholder="Atividades realizadas neste setor..."
              />
            </div>

            {/* Riscos por categoria */}
            <div>
              <label className="label">Riscos Ocupacionais do Setor</label>
              <p className="text-xs text-slate-500 mb-3">
                Adicione os riscos ambientais presentes neste setor. Serão
                herdados pelos cargos vinculados.
              </p>
              <div className="space-y-3">
                {CATEGORIAS_RISCO.map(({ key, label, icon }) => (
                  <div key={key} className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      {icon} {label}
                    </p>
                    {/* Lista atual */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(form.riscos_ocupacionais[key] || []).map((r, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700"
                        >
                          {r}
                          <button
                            type="button"
                            onClick={() => removeRisco(key, i)}
                          >
                            <X className="h-3 w-3 text-slate-400 hover:text-red-500" />
                          </button>
                        </span>
                      ))}
                    </div>
                    {/* Adicionar */}
                    <div className="flex gap-2">
                      <input
                        className="input text-xs flex-1"
                        placeholder={`Adicionar risco ${label.toLowerCase()}...`}
                        value={newRisco[key] || ""}
                        onChange={(e) =>
                          setNewRisco((p) => ({ ...p, [key]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addRisco(key);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => addRisco(key)}
                        className="btn-ghost text-xs text-primary-600"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={saving || !form.nome.trim()}
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isEdit ? (
                  "Salvar"
                ) : (
                  "Criar Setor"
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </>
  );
}
