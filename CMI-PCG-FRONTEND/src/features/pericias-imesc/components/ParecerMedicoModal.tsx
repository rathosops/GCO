import { initialFrom } from "@/utils/initials";
import { useState, useEffect } from "react";
import {
  X,
  Loader2,
  Stethoscope,
  User,
  FileText,
  CheckCircle,
  UserCheck,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Calendar,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import EntityPicker from "@/components/common/EntityPicker";
import { medicosAPI } from "@/services/api";
import type { PericiaIMESC, ParecerMedicoData } from "../types";
import type { Medico } from "@/types";

interface ParecerMedicoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ParecerMedicoData) => Promise<void>;
  pericia: PericiaIMESC | null;
  saving?: boolean;
}

export function ParecerMedicoModal({
  isOpen,
  onClose,
  onSubmit,
  pericia,
  saving = false,
}: ParecerMedicoModalProps) {
  const [medico, setMedico] = useState<Medico | null>(null);
  const [parecerMedico, setParecerMedico] = useState("");
  const [conclusaoMedica, setConclusaoMedica] = useState("");
  const [cid, setCid] = useState("");
  const [showParecerSocial, setShowParecerSocial] = useState(true);

  useEffect(() => {
    if (isOpen && pericia) {
      setParecerMedico(pericia.parecer_medico || "");
      setConclusaoMedica(pericia.conclusao_medica || "");
      setCid(pericia.cid || "");
      setMedico(null);
      setShowParecerSocial(true);
    }
  }, [isOpen, pericia]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medico?.crm) return alert("Selecione o médico responsável");
    if (!parecerMedico.trim()) return alert("O parecer médico é obrigatório");
    if (!conclusaoMedica.trim()) return alert("A conclusão médica é obrigatória");

    await onSubmit({
      parecer_medico: parecerMedico.trim(),
      conclusao_medica: conclusaoMedica.trim(),
      cid: cid.trim().toUpperCase() || undefined,
      crm_medico: Number(medico.crm),
    });
  };

  const loadMedicos = async (q: string) =>
    (await medicosAPI.getAll({ nome: q })).slice(0, 10);

  const formatDateBr = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("pt-BR", { 
        day: "2-digit", month: "2-digit", year: "numeric", 
        hour: "2-digit", minute: "2-digit" 
      });
    } catch {
      return dateStr;
    }
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
          className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-secondary-200 bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-xl">
                <Stethoscope className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-secondary-900">Parecer Médico</h2>
                <p className="text-xs text-secondary-500">Conclusão da perícia IMESC</p>
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost p-2" disabled={saving}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-secondary-200">
              {/* Coluna Esquerda - Contexto */}
              <div className="p-5 space-y-4 bg-secondary-50/30">
                {/* Paciente */}
                <div className="p-4 bg-white rounded-xl border border-secondary-200">
                  <p className="text-xs font-medium text-secondary-500 uppercase mb-2">Paciente</p>
                  <div className="flex items-center gap-3">
                    <div className="avatar-md bg-teal-100 text-teal-700 flex-shrink-0">
                      {initialFrom(pericia?.nome_paciente, "P")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-secondary-900 truncate">
                        {pericia.nome_paciente || "Paciente"}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {pericia.cpf_paciente}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {pericia.protocolo}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-secondary-100 text-xs text-secondary-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {pericia.data_pericia_br || pericia.data_pericia}
                    </span>
                    {pericia.hora_pericia && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {pericia.hora_pericia}
                      </span>
                    )}
                  </div>
                </div>

                {/* Parecer Social - Expandível */}
                {pericia.parecer_social && (
                  <div className="bg-white rounded-xl border border-green-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowParecerSocial(!showParecerSocial)}
                      className="w-full flex items-center justify-between p-4 hover:bg-green-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div className="text-left">
                          <p className="font-medium text-green-700">Triagem Social Concluída</p>
                          <p className="text-xs text-green-600">
                            {pericia.nome_assistente && `Por: ${pericia.nome_assistente}`}
                            {pericia.cress_assistente && ` · CRESS: ${pericia.cress_assistente}`}
                          </p>
                        </div>
                      </div>
                      {showParecerSocial ? (
                        <ChevronUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-green-500" />
                      )}
                    </button>

                    <AnimatePresence>
                      {showParecerSocial && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-3">
                            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                              <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="h-4 w-4 text-green-600" />
                                <p className="text-xs font-medium text-green-700 uppercase">
                                  Parecer da Assistente Social
                                </p>
                              </div>
                              <p className="text-sm text-secondary-700 whitespace-pre-wrap leading-relaxed">
                                {pericia.parecer_social}
                              </p>
                              {pericia.data_parecer_social && (
                                <p className="text-xs text-green-600 mt-2 pt-2 border-t border-green-100">
                                  Registrado em: {formatDateBr(pericia.data_parecer_social)}
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Observações da Perícia */}
                {pericia.observacoes && (
                  <div className="p-4 bg-white rounded-xl border border-secondary-200">
                    <p className="text-xs font-medium text-secondary-500 uppercase mb-2">
                      Observações da Perícia
                    </p>
                    <p className="text-sm text-secondary-700 whitespace-pre-wrap">
                      {pericia.observacoes}
                    </p>
                  </div>
                )}
              </div>

              {/* Coluna Direita - Formulário */}
              <div className="p-5">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <EntityPicker<Medico>
                    title="Médico Responsável *"
                    placeholder="Buscar médico por nome..."
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
                      Parecer Médico *
                    </label>
                    <textarea
                      value={parecerMedico}
                      onChange={(e) => setParecerMedico(e.target.value)}
                      placeholder="Descreva o parecer médico, análise clínica, exame físico, histórico relevante..."
                      className="input w-full min-h-[160px] resize-y text-base py-3 leading-relaxed"
                      required
                      rows={6}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-secondary-700 mb-2">
                      Conclusão Médica *
                    </label>
                    <textarea
                      value={conclusaoMedica}
                      onChange={(e) => setConclusaoMedica(e.target.value)}
                      placeholder="Conclusão final da perícia médica, diagnóstico, recomendações..."
                      className="input w-full min-h-[100px] resize-y text-base py-3 leading-relaxed"
                      required
                      rows={4}
                    />
                  </div>

                  <div className="max-w-xs">
                    <label className="block text-sm font-semibold text-secondary-700 mb-2">
                      CID (opcional)
                    </label>
                    <input
                      type="text"
                      value={cid}
                      onChange={(e) => setCid(e.target.value.toUpperCase())}
                      placeholder="Ex: F32.1"
                      className="input w-full text-base py-3 uppercase"
                      maxLength={10}
                    />
                    <p className="text-xs text-secondary-400 mt-1">
                      Código Internacional de Doenças
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>

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
              disabled={saving || !medico}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Stethoscope className="h-4 w-4" />
                  Concluir Perícia
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ParecerMedicoModal;
