/**
 * Modal de criação/edição de cargo
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Briefcase, X, Loader2, Plus } from "lucide-react";
import type {
  Cargo,
  CargoFormData,
  Setor,
  RiscosOcupacionais,
  ExamesObrigatorios,
} from "../types";
import {
  CATEGORIAS_RISCO,
  NRS_LABELS,
  TIPO_ASO_LABELS,
  INITIAL_CARGO_FORM,
} from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CargoFormData) => Promise<void>;
  initialData?: Cargo | null;
  setores: Setor[];
  saving: boolean;
}

export function CargoFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  setores,
  saving,
}: Props) {
  const isEdit = !!initialData;
  const [form, setForm] = useState<CargoFormData>(INITIAL_CARGO_FORM);
  const [newRisco, setNewRisco] = useState<Record<string, string>>({});
  const [newExame, setNewExame] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setForm({
        nome: initialData.nome,
        setor_id: initialData.setor_id?.toString() || "",
        cbo: initialData.cbo || "",
        descricao: initialData.descricao || "",
        riscos_ocupacionais: { ...initialData.riscos_ocupacionais },
        exames_obrigatorios: { ...initialData.exames_obrigatorios },
        nrs_aplicaveis: { ...initialData.nrs_aplicaveis },
        periodicidade_meses:
          initialData.periodicidade_meses?.toString() || "12",
        manipula_alimentos: initialData.manipula_alimentos || false,
      });
    } else {
      setForm({
        ...INITIAL_CARGO_FORM,
        riscos_ocupacionais: {},
        exames_obrigatorios: {},
        nrs_aplicaveis: {},
      });
    }
    setNewRisco({});
    setNewExame({});
  }, [isOpen, initialData]);

  const set = (field: keyof CargoFormData, value: any) =>
    setForm((p) => ({ ...p, [field]: value }));

  const addRisco = (cat: keyof RiscosOcupacionais) => {
    const val = newRisco[cat]?.trim();
    if (!val) return;
    set("riscos_ocupacionais", {
      ...form.riscos_ocupacionais,
      [cat]: [...(form.riscos_ocupacionais[cat] || []), val],
    });
    setNewRisco((p) => ({ ...p, [cat]: "" }));
  };

  const removeRisco = (cat: keyof RiscosOcupacionais, idx: number) => {
    set("riscos_ocupacionais", {
      ...form.riscos_ocupacionais,
      [cat]: (form.riscos_ocupacionais[cat] || []).filter((_, i) => i !== idx),
    });
  };

  const addExame = (tipo: keyof ExamesObrigatorios) => {
    const val = newExame[tipo]?.trim();
    if (!val) return;
    set("exames_obrigatorios", {
      ...form.exames_obrigatorios,
      [tipo]: [...(form.exames_obrigatorios[tipo] || []), val],
    });
    setNewExame((p) => ({ ...p, [tipo]: "" }));
  };

  const removeExame = (tipo: keyof ExamesObrigatorios, idx: number) => {
    set("exames_obrigatorios", {
      ...form.exames_obrigatorios,
      [tipo]: (form.exames_obrigatorios[tipo] || []).filter(
        (_, i) => i !== idx,
      ),
    });
  };

  const toggleNR = (nr: string) => {
    set("nrs_aplicaveis", {
      ...form.nrs_aplicaveis,
      [nr]: !form.nrs_aplicaveis[nr],
    });
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
          className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-xl">
                <Briefcase className="h-5 w-5 text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {isEdit ? "Editar Cargo" : "Novo Cargo"}
              </h3>
            </div>
            <button onClick={onClose} className="btn-icon btn-ghost">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Básico */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Nome do Cargo *</label>
                <input
                  className="input"
                  value={form.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  placeholder="Ex: Operador de Máquinas"
                />
              </div>
              <div>
                <label className="label">CBO</label>
                <input
                  className="input"
                  value={form.cbo}
                  onChange={(e) => set("cbo", e.target.value)}
                  placeholder="Ex: 7152-05"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Setor</label>
                <select
                  className="select"
                  value={form.setor_id}
                  onChange={(e) => set("setor_id", e.target.value)}
                >
                  <option value="">Nenhum (sem setor)</option>
                  {setores
                    .filter((s) => s.ativo)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="label">Periodicidade (meses)</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="60"
                  value={form.periodicidade_meses}
                  onChange={(e) => set("periodicidade_meses", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Descrição das atividades</label>
              <textarea
                className="input min-h-[60px]"
                value={form.descricao}
                onChange={(e) => set("descricao", e.target.value)}
                placeholder="Descreva as principais atividades deste cargo..."
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary-600"
                checked={form.manipula_alimentos}
                onChange={(e) => set("manipula_alimentos", e.target.checked)}
              />
              <span className="text-sm text-slate-700">Manipula alimentos</span>
            </label>

            {/* NRs aplicáveis */}
            <div>
              <label className="label">NRs Aplicáveis</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {Object.entries(NRS_LABELS).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600"
                      checked={!!form.nrs_aplicaveis[key]}
                      onChange={() => toggleNR(key)}
                    />
                    <span className="text-slate-600">
                      {label.split(" ").slice(0, 2).join(" ")}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Riscos */}
            <div>
              <label className="label">Riscos Ocupacionais do Cargo</label>
              <p className="text-xs text-slate-500 mb-2">
                Riscos específicos deste cargo (se o setor já tiver riscos,
                serão combinados).
              </p>
              <div className="space-y-2">
                {CATEGORIAS_RISCO.map(({ key, label, icon }) => (
                  <div key={key} className="p-2 bg-slate-50 rounded-lg">
                    <p className="text-xs font-semibold text-slate-600 mb-1">
                      {icon} {label}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {(form.riscos_ocupacionais[key] || []).map((r, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white border border-slate-200"
                        >
                          {r}
                          <button
                            type="button"
                            onClick={() => removeRisco(key, i)}
                          >
                            <X className="h-2.5 w-2.5 text-slate-400 hover:text-red-500" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        className="input text-xs flex-1 py-1"
                        placeholder={`Adicionar...`}
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
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Exames obrigatórios por tipo de ASO */}
            <div>
              <label className="label">
                Exames Obrigatórios por Tipo de ASO
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Esses exames serão sugeridos automaticamente ao gerar o ASO.
              </p>
              <div className="space-y-2">
                {(
                  Object.entries(TIPO_ASO_LABELS) as [
                    keyof ExamesObrigatorios,
                    string,
                  ][]
                ).map(([tipo, label]) => (
                  <div key={tipo} className="p-2 bg-slate-50 rounded-lg">
                    <p className="text-xs font-semibold text-slate-600 mb-1">
                      {label}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {(form.exames_obrigatorios[tipo] || []).map((e, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white border border-slate-200"
                        >
                          {e}
                          <button
                            type="button"
                            onClick={() => removeExame(tipo, i)}
                          >
                            <X className="h-2.5 w-2.5 text-slate-400 hover:text-red-500" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        className="input text-xs flex-1 py-1"
                        placeholder="Ex: Hemograma, Audiometria..."
                        value={newExame[tipo] || ""}
                        onChange={(e) =>
                          setNewExame((p) => ({ ...p, [tipo]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addExame(tipo);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => addExame(tipo)}
                        className="btn-ghost text-xs text-primary-600"
                      >
                        <Plus className="h-3 w-3" />
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
                  "Criar Cargo"
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </>
  );
}
