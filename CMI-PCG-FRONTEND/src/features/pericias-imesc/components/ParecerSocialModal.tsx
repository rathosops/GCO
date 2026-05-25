import { initialFrom } from "@/utils/initials";
import { useState, useEffect } from "react";
import { X, Loader2, UserCheck, User, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import EntityPicker from "@/components/common/EntityPicker";
import { assistentesSociaisAPI } from "../api";
import type {
  PericiaIMESC,
  ParecerSocialData,
  AssistenteSocialAutocomplete,
} from "../types";

interface ParecerSocialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ParecerSocialData) => Promise<void>;
  pericia: PericiaIMESC | null;
  saving?: boolean;
}

export function ParecerSocialModal({
  isOpen,
  onClose,
  onSubmit,
  pericia,
  saving = false,
}: ParecerSocialModalProps) {
  const [parecerSocial, setParecerSocial] = useState("");
  const [assistenteSocial, setAssistenteSocial] =
    useState<AssistenteSocialAutocomplete | null>(null);

  useEffect(() => {
    if (isOpen && pericia) {
      setParecerSocial(pericia.parecer_social || "");

      // Backend atual: nome_assistente / cress_assistente
      if (pericia.cress_assistente || pericia.nome_assistente) {
        setAssistenteSocial({
          id: 0, // backend não retorna id no payload da perícia
          nome: pericia.nome_assistente || "Assistente",
          cress: pericia.cress_assistente || "",
          ativo: true,
        });
      } else {
        setAssistenteSocial(null);
      }
    }
  }, [isOpen, pericia]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parecerSocial.trim()) {
      alert("O parecer social é obrigatório");
      return;
    }

    if (!assistenteSocial || !assistenteSocial.cress?.trim()) {
      alert("Selecione o(a) assistente social responsável");
      return;
    }

    await onSubmit({
      parecer_social: parecerSocial.trim(),
      cress_assistente: assistenteSocial.cress.trim(),
    });
  };

  const loadAssistentesSociais = async (q: string) => {
    const results = await assistentesSociaisAPI.autocomplete(q);
    // Filtra apenas ativos (se vier ativo)
    return results.filter((a) => a.ativo !== false);
  };

  if (!isOpen || !pericia) return null;

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
          <div className="flex items-center justify-between p-5 border-b border-secondary-200 bg-gradient-to-r from-green-50 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-100 rounded-xl">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-secondary-900">
                  Triagem Social
                </h2>
                <p className="text-xs text-secondary-500">
                  Registro do parecer social
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

          {/* Paciente Info */}
          <div className="mx-5 mt-5 p-4 bg-secondary-50 rounded-xl border border-secondary-200">
            <div className="flex items-center gap-3">
              <div className="avatar-lg bg-teal-100 text-teal-700">
                {initialFrom(pericia?.nome_paciente, "P")}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="font-semibold text-secondary-900 text-base truncate"
                  title={pericia.nome_paciente}
                >
                  {pericia.nome_paciente || "Paciente"}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary-500">
                  {pericia.cpf_paciente && (
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      CPF: {pericia.cpf_paciente}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {pericia.protocolo}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Seleção de Assistente Social */}
            <EntityPicker<AssistenteSocialAutocomplete>
              title="Assistente Social Responsável *"
              placeholder="Buscar por nome ou CRESS..."
              selected={assistenteSocial}
              onSelect={setAssistenteSocial}
              onClear={() => setAssistenteSocial(null)}
              load={loadAssistentesSociais}
              renderItem={(a) => ({
                title: a.nome,
                subtitle: `CRESS: ${a.cress}`,
              })}
              minChars={2}
            />

            {/* Caso já exista assistente na perícia, mostra referência */}
            {!assistenteSocial &&
              (pericia.nome_assistente || pericia.cress_assistente) && (
                <p className="text-xs text-secondary-500 -mt-3">
                  Atual:{" "}
                  {pericia.nome_assistente ? pericia.nome_assistente : "Assistente"}
                  {pericia.cress_assistente
                    ? ` · CRESS: ${pericia.cress_assistente}`
                    : ""}
                </p>
              )}

            {/* Parecer Social */}
            <div>
              <label className="block text-sm font-semibold text-secondary-700 mb-2">
                Parecer Social *
              </label>
              <textarea
                value={parecerSocial}
                onChange={(e) => setParecerSocial(e.target.value)}
                placeholder="Descreva o parecer social, condições socioeconômicas, observações relevantes..."
                className="input w-full min-h-[200px] resize-y text-base py-3 leading-relaxed"
                required
                rows={8}
              />
              <p className="text-xs text-secondary-400 mt-2">
                Este parecer será incluído no documento final da perícia.
              </p>
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
              className="btn-primary px-6 py-2.5 bg-green-600 hover:bg-green-700"
              disabled={saving || !assistenteSocial || !assistenteSocial.cress}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  Registrar Triagem
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ParecerSocialModal;
