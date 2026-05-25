/**
 * Modal de criação de vínculo empregatício
 * Usa EntityPicker para selecionar paciente
 */

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link2, X, Loader2 } from "lucide-react";
import EntityPicker from "@/components/common/EntityPicker";
import { pacientesApi } from "@/features/pacientes/api";
import type { PacienteAutocomplete } from "@/features/pacientes/types";
import type { VinculoFormData, Setor, Cargo } from "../types";
import { INITIAL_VINCULO_FORM } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: VinculoFormData) => Promise<void>;
  setores: Setor[];
  cargos: Cargo[];
  saving: boolean;
}

export function VinculoFormModal({
  isOpen,
  onClose,
  onSubmit,
  setores,
  cargos,
  saving,
}: Props) {
  const [form, setForm] = useState<VinculoFormData>(INITIAL_VINCULO_FORM);
  const [selectedPaciente, setSelectedPaciente] =
    useState<PacienteAutocomplete | null>(null);
  const [filteredCargos, setFilteredCargos] = useState<Cargo[]>(cargos);

  useEffect(() => {
    if (!isOpen) return;
    setForm({ ...INITIAL_VINCULO_FORM });
    setSelectedPaciente(null);
    setFilteredCargos(cargos);
  }, [isOpen, cargos]);

  // Filtra cargos quando muda setor
  useEffect(() => {
    if (form.setor_id) {
      setFilteredCargos(
        cargos.filter(
          (c) => c.setor_id === Number(form.setor_id) || !c.setor_id,
        ),
      );
    } else {
      setFilteredCargos(cargos);
    }
  }, [form.setor_id, cargos]);

  // Auto-preenche função com nome do cargo
  const handleCargoChange = (cargoId: string) => {
    setForm((p) => ({ ...p, cargo_id: cargoId }));
    const cargo = cargos.find((c) => c.id === Number(cargoId));
    if (cargo && !form.funcao) {
      setForm((p) => ({ ...p, funcao: cargo.nome }));
    }
    // Auto-preenche setor do cargo
    if (cargo?.setor_id && !form.setor_id) {
      setForm((p) => ({ ...p, setor_id: cargo.setor_id!.toString() }));
    }
  };

  const loadPacientes = useCallback(
    async (q: string) => (q.length < 2 ? [] : pacientesApi.autocomplete(q, 10)),
    [],
  );

  const set = (field: keyof VinculoFormData, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.paciente_id || !form.funcao || !form.data_admissao) return;
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
              <div className="p-2 bg-emerald-100 rounded-xl">
                <Link2 className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Novo Vínculo Empregatício
              </h3>
            </div>
            <button onClick={onClose} className="btn-icon btn-ghost">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Paciente picker */}
            <EntityPicker<PacienteAutocomplete>
              title="Paciente / Trabalhador *"
              placeholder="Buscar por nome ou CPF..."
              selected={selectedPaciente}
              onSelect={(p) => {
                setSelectedPaciente(p);
                set("paciente_id", p.id.toString());
              }}
              onClear={() => {
                setSelectedPaciente(null);
                set("paciente_id", "");
              }}
              load={loadPacientes}
              renderItem={(p) => ({
                title: p.nome,
                subtitle: p.cpf,
                right: p.idade ? `${p.idade} anos` : undefined,
              })}
              minChars={2}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Cargo</label>
                <select
                  className="select"
                  value={form.cargo_id}
                  onChange={(e) => handleCargoChange(e.target.value)}
                >
                  <option value="">Selecione o cargo</option>
                  {filteredCargos
                    .filter((c) => c.ativo)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.setor_nome ? `(${c.setor_nome})` : ""}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="label">Setor</label>
                <select
                  className="select"
                  value={form.setor_id}
                  onChange={(e) => set("setor_id", e.target.value)}
                >
                  <option value="">Selecione o setor</option>
                  {setores
                    .filter((s) => s.ativo)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Função *</label>
              <input
                className="input"
                value={form.funcao}
                onChange={(e) => set("funcao", e.target.value)}
                placeholder="Função exercida pelo trabalhador"
              />
              <p className="text-xs text-slate-400 mt-1">
                Preenchido automaticamente ao selecionar cargo, mas pode ser
                editado.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Data de Admissão *</label>
                <input
                  className="input"
                  type="date"
                  value={form.data_admissao}
                  onChange={(e) => set("data_admissao", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Matrícula</label>
                <input
                  className="input"
                  value={form.matricula}
                  onChange={(e) => set("matricula", e.target.value)}
                  placeholder="Número de matrícula"
                />
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
                disabled={
                  saving ||
                  !form.paciente_id ||
                  !form.funcao ||
                  !form.data_admissao
                }
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Criar Vínculo"
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </>
  );
}
