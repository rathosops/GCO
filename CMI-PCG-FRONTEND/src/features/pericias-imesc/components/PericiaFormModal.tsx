import { useState, useEffect } from "react";
import { X, Loader2, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import EntityPicker from "@/components/common/EntityPicker";
import {
  autocompleteAPI,
  type AutocompletePaciente,
} from "@/services/autocomplete.api";
import { medicosAPI } from "@/services/api";
import type { PericiaIMESC, PericiaFormData } from "../types";
import type { Medico } from "@/types";

interface PericiaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PericiaFormData) => Promise<void>;
  initialData?: PericiaIMESC | null;
  saving?: boolean;
}

export function PericiaFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  saving = false,
}: PericiaFormModalProps) {
  const isEdit = !!initialData;

  const [protocolo, setProtocolo] = useState("");
  const [dataPericia, setDataPericia] = useState("");
  const [horaPericia, setHoraPericia] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [paciente, setPaciente] = useState<AutocompletePaciente | null>(null);
  const [medico, setMedico] = useState<Medico | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setProtocolo(initialData.protocolo || "");
        setDataPericia(initialData.data_pericia || "");
        setHoraPericia(initialData.hora_pericia || "");
        setObservacoes(initialData.observacoes || "");
        if (initialData.cpf_paciente) {
          setPaciente({
            id: 0,
            nome: initialData.nome_paciente || "",
            cpf: initialData.cpf_paciente,
            cpf_raw: 0,
          });
        }
      } else {
        setProtocolo("");
        setDataPericia(new Date().toISOString().split("T")[0]);
        setHoraPericia("");
        setObservacoes("");
        setPaciente(null);
        setMedico(null);
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!protocolo.trim()) return alert("Protocolo é obrigatório");
    if (!paciente) return alert("Selecione um paciente");
    if (!dataPericia) return alert("Data da perícia é obrigatória");

    await onSubmit({
      protocolo: protocolo.trim(),
      cpf_paciente: paciente.cpf.replace(/\D/g, ""),
      data_pericia: dataPericia,
      hora_pericia: horaPericia || undefined,
      crm_medico: medico?.crm ? Number(medico.crm) : undefined,
      observacoes: observacoes.trim() || undefined,
    });
  };

  const loadPacientes = async (q: string) =>
    autocompleteAPI.pacientes(q, { limit: 10 });
  const loadMedicos = async (q: string) =>
    (await medicosAPI.getAll({ nome: q })).slice(0, 10);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-secondary-200 bg-gradient-to-r from-teal-50 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-xl">
                <FileText className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-secondary-900">
                  {isEdit ? "Editar Perícia" : "Nova Perícia IMESC"}
                </h2>
                <p className="text-xs text-secondary-500">
                  Preencha os dados da perícia
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-ghost p-2"
              disabled={saving}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="p-5 space-y-5 overflow-y-auto max-h-[calc(90vh-160px)]"
          >
            <div>
              <label className="block text-sm font-semibold text-secondary-700 mb-2">
                Protocolo IMESC *
              </label>
              <input
                type="text"
                value={protocolo}
                onChange={(e) => setProtocolo(e.target.value)}
                placeholder="Ex: CLI - 12345"
                className="input w-full text-base py-3"
                required
              />
            </div>

            <EntityPicker<AutocompletePaciente>
              title="Paciente *"
              placeholder="Buscar por nome ou CPF..."
              selected={paciente}
              onSelect={setPaciente}
              onClear={() => setPaciente(null)}
              load={loadPacientes}
              renderItem={(p) => ({ title: p.nome, subtitle: p.cpf })}
              minChars={2}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-secondary-700 mb-2">
                  Data da Perícia *
                </label>
                <input
                  type="date"
                  value={dataPericia}
                  onChange={(e) => setDataPericia(e.target.value)}
                  className="input w-full text-base py-3"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-secondary-700 mb-2">
                  Hora
                </label>
                <input
                  type="time"
                  value={horaPericia}
                  onChange={(e) => setHoraPericia(e.target.value)}
                  className="input w-full text-base py-3"
                />
              </div>
            </div>

            <EntityPicker<Medico>
              title="Médico Responsável (opcional)"
              placeholder="Buscar médico..."
              selected={medico}
              onSelect={setMedico}
              onClear={() => setMedico(null)}
              load={loadMedicos}
              renderItem={(m) => ({
                title: m.nome,
                subtitle: `CRM: ${m.crm}`,
                right: m.especialidade,
              })}
              minChars={2}
            />

            <div>
              <label className="block text-sm font-semibold text-secondary-700 mb-2">
                Observações
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações gerais..."
                className="input w-full min-h-[100px] resize-y text-base py-3"
                rows={4}
              />
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-5 border-t border-secondary-200 bg-secondary-50">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-6 py-2.5"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              className="btn-primary px-6 py-2.5"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : isEdit ? (
                "Salvar Alterações"
              ) : (
                "Cadastrar Perícia"
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default PericiaFormModal;
