/**
 * Modal de formulário para criar/editar consultas */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  X,
  Loader2,
  Save,
  Stethoscope,
  User,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  Pill,
  Calendar,
} from "lucide-react";

import type {
  ConsultaFormData,
  MedicoOption,
  ProcedimentoOption,
  Consulta,
} from "@/features/consultas/types/consultas.types";
import type { Paciente } from "@/types";
import { pacientesAPI } from "@/services/api";
import { debounce } from "@/utils/debounce";
import { useToast } from "@/components/feedback/toast";

interface ConsultaFormModalProps {
  consulta?: Consulta | null;
  medicos: MedicoOption[];
  procedimentos: ProcedimentoOption[];
  onSave: (data: ConsultaFormData) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
  initialData?: {
    cpf_paciente?: string;
    nome_paciente?: string;
    tipo?: string;
  } | null;
}

type FormErrors = Partial<Record<keyof ConsultaFormData, string>> & {
  cpf_paciente?: string;
  crm_medico?: string;
  tipo?: string;
  anamnese?: string;
  medicamentos_prescrevidos?: string;
};

function onlyDigits(value: string) {
  return (value || "").replace(/\D/g, "");
}

function fmtCpf(cpf: string | number) {
  const d = onlyDigits(String(cpf)).slice(0, 11);
  if (d.length !== 11) return String(cpf);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const payload = err.response?.data as any;
    const apiMsg =
      payload?.error ||
      payload?.message ||
      (typeof payload === "string" ? payload : null) ||
      err.message;
    return status ? `(${status}) ${apiMsg}` : String(apiMsg);
  }
  if (err instanceof Error) return err.message;
  return "Erro inesperado";
}

const INITIAL_FORM: ConsultaFormData = {
  cpf_paciente: "",
  crm_medico: "",
  tipo: "",
  anamnese: "",
  queixa_principal: "",
  historia_doenca_atual: "",
  exame_fisico: "",
  procedimentos: "",
  diagnostico: "",
  cid: "",
  conduta: "",
  houve_solicitacao_de_exame: false,
  houve_prescricao_medicamentos: false,
  medicamentos_prescrevidos: "",
  retorno_em: undefined,
  data_retorno: "",
  observacoes_internas: "",
};

export function ConsultaFormModal({
  consulta,
  medicos,
  procedimentos,
  onSave,
  onClose,
  loading = false,
  initialData,
}: ConsultaFormModalProps) {
  const toast = useToast();

  const [form, setForm] = useState<ConsultaFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [expandedSections, setExpandedSections] = useState({
    anamnese: true,
    diagnostico: true,
    prescricoes: false,
    retorno: false,
  });

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [pacQuery, setPacQuery] = useState("");
  const [pacLoading, setPacLoading] = useState(false);
  const [pacOptions, setPacOptions] = useState<Paciente[]>([]);
  const [pacOpen, setPacOpen] = useState(false);

  const blurTimerRef = useRef<number | null>(null);
  const isEdit = Boolean(consulta?.id);

  const safeClose = useCallback(() => {
    if (loading) return;
    onClose();
  }, [loading, onClose]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (consulta) {
      setForm({
        cpf_paciente: String(consulta.cpf_paciente || ""),
        crm_medico: String(consulta.crm_medico || ""),
        tipo: consulta.tipo || "",
        anamnese: consulta.anamnese || "",
        queixa_principal: consulta.queixa_principal || "",
        historia_doenca_atual: consulta.historia_doenca_atual || "",
        exame_fisico: consulta.exame_fisico || "",
        procedimentos: consulta.procedimentos || "",
        diagnostico: consulta.diagnostico || "",
        cid: consulta.cid || "",
        conduta: consulta.conduta || "",
        houve_solicitacao_de_exame: Boolean(
          consulta.houve_solicitacao_de_exame,
        ),
        houve_prescricao_medicamentos: Boolean(
          consulta.houve_prescricao_medicamentos,
        ),
        medicamentos_prescrevidos: consulta.medicamentos_prescrevidos || "",
        retorno_em: consulta.retorno_em || undefined,
        data_retorno: consulta.data_retorno || "",
        observacoes_internas: consulta.observacoes_internas || "",
      });

      if (consulta.paciente?.nome) {
        const p: Paciente = {
          ...(paciente ?? ({} as Paciente)),
          nome: consulta.paciente.nome,
          cpf: fmtCpf(consulta.cpf_paciente || ""),
        };
        setPaciente(p);
        setPacQuery(consulta.paciente.nome);
      } else {
        setPaciente(null);
        setPacQuery("");
      }
      setErrors({});
      return;
    }

    if (initialData) {
      setForm({
        ...INITIAL_FORM,
        cpf_paciente: initialData.cpf_paciente || "",
        tipo: initialData.tipo || "",
      });

      if (initialData.cpf_paciente && initialData.cpf_paciente.length === 11) {
        const fetchPaciente = async () => {
          try {
            const pac = await pacientesAPI.getByCpf(initialData.cpf_paciente!);
            if (pac) {
              setPaciente(pac);
              setPacQuery(pac.nome || initialData.nome_paciente || "");
            } else {
              setPacQuery(initialData.nome_paciente || "");
            }
          } catch {
            setPacQuery(initialData.nome_paciente || "");
          }
        };
        fetchPaciente();
      } else if (initialData.nome_paciente) {
        setPacQuery(initialData.nome_paciente);
        setPaciente(null);
      }
      setErrors({});
      return;
    }

    setForm(INITIAL_FORM);
    setPaciente(null);
    setPacQuery("");
    setErrors({});
  }, [
    consulta?.id,
    initialData?.cpf_paciente,
    initialData?.nome_paciente,
    initialData?.tipo,
  ]);

  const fetchPacientes = useMemo(
    () =>
      debounce(async (q: string) => {
        const term = q.trim();
        if (term.length < 2) {
          setPacOptions([]);
          setPacLoading(false);
          return;
        }
        try {
          setPacLoading(true);
          const data = await pacientesAPI.getAll({
            search: term,
            limit: 10,
            offset: 0,
          });
          setPacOptions(Array.isArray(data) ? data : []);
        } catch {
          setPacOptions([]);
        } finally {
          setPacLoading(false);
        }
      }, 300),
    [],
  );

  useEffect(() => {
    fetchPacientes(pacQuery);
  }, [pacQuery, fetchPacientes]);

  const selectPaciente = useCallback((p: Paciente) => {
    setPaciente(p);
    setPacQuery(p.nome || "");
    setForm((prev) => ({
      ...prev,
      cpf_paciente: onlyDigits(String(p.cpf || "")),
    }));
    setPacOpen(false);
    setErrors((prev) => ({ ...prev, cpf_paciente: "" }));
  }, []);

  const handleChange = useCallback(
    <K extends keyof ConsultaFormData>(key: K, value: ConsultaFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: "" }));
    },
    [],
  );

  const toggleSection = useCallback(
    (section: keyof typeof expandedSections) => {
      setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    },
    [],
  );

  const validate = useCallback((data: ConsultaFormData): FormErrors => {
    const newErrors: FormErrors = {};
    const cpfDigits = onlyDigits(data.cpf_paciente);
    const crmDigits = onlyDigits(data.crm_medico);

    if (!cpfDigits || cpfDigits.length !== 11) {
      newErrors.cpf_paciente =
        "Selecione um paciente válido (CPF com 11 dígitos).";
    }
    if (!crmDigits || crmDigits.length < 4) {
      newErrors.crm_medico = "Selecione um médico válido.";
    }
    if (!data.tipo?.trim()) {
      newErrors.tipo = "Selecione o tipo/procedimento.";
    }
    if (!data.anamnese?.trim()) {
      newErrors.anamnese = "Anamnese é obrigatória.";
    }
    if (
      data.houve_prescricao_medicamentos &&
      !data.medicamentos_prescrevidos?.trim()
    ) {
      newErrors.medicamentos_prescrevidos =
        "Informe os medicamentos prescritos ou desmarque a opção.";
    }
    return newErrors;
  }, []);

  const buildPayload = useCallback(
    (data: ConsultaFormData): ConsultaFormData => {
      const cpfDigits = onlyDigits(data.cpf_paciente);
      const crmDigits = onlyDigits(data.crm_medico);

      return {
        ...data,
        cpf_paciente: cpfDigits,
        crm_medico: crmDigits,
        tipo: (data.tipo || "").trim(),
        procedimentos: (data.procedimentos || "").trim(),
        diagnostico: (data.diagnostico || "").trim(),
        cid: (data.cid || "").trim(),
        conduta: (data.conduta || "").trim(),
        observacoes_internas: (data.observacoes_internas || "").trim(),
        medicamentos_prescrevidos: data.houve_prescricao_medicamentos
          ? (data.medicamentos_prescrevidos || "").trim()
          : "",
      };
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;

      const newErrors = validate(form);
      setErrors(newErrors);

      if (Object.keys(newErrors).length > 0) {
        const firstKey = Object.keys(newErrors)[0] as keyof FormErrors;
        toast.error(
          String(newErrors[firstKey] || "Revise o formulário."),
          "Revise o formulário",
        );
        return;
      }

      const payload = buildPayload(form);

      try {
        await onSave(payload);
        toast.success(
          isEdit ? "Consulta atualizada." : "Consulta cadastrada.",
          "Sucesso",
        );
      } catch (err) {
        console.error("Erro ao salvar (modal):", err);
        toast.error(extractErrorMessage(err), "Não foi possível salvar");
      }
    },
    [buildPayload, form, isEdit, loading, onSave, toast, validate],
  );

  const handlePacienteBlur = useCallback(() => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    blurTimerRef.current = window.setTimeout(() => setPacOpen(false), 200);
  }, []);

  const handlePacienteFocus = useCallback(() => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    setPacOpen(true);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={safeClose}
        className="fixed inset-0 bg-black/50 z-40"
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          onClick={(e) => e.stopPropagation()}
          className="card w-full max-w-6xl 2xl:max-w-7xl max-h-[96vh] overflow-hidden flex flex-col"
        >
          <div className="flex items-start sm:items-center justify-between gap-3 pb-4 border-b flex-shrink-0">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="p-2 bg-purple-100 rounded-xl flex-shrink-0">
                <Stethoscope className="h-6 w-6 text-purple-700" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-secondary-900 truncate">
                  {isEdit ? "Editar Consulta" : "Nova Consulta"}
                </h3>
                <p className="text-sm text-secondary-500">
                  Preencha os dados da consulta médica
                </p>
              </div>
            </div>
            <button
              onClick={safeClose}
              className="btn-icon btn-ghost"
              disabled={loading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form
            id="consulta-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto py-4"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="label">Paciente *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
                    <input
                      type="text"
                      className={`input pl-10 ${errors.cpf_paciente ? "border-red-500" : ""}`}
                      placeholder="Digite nome ou CPF..."
                      value={pacQuery}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPacQuery(v);
                        setPacOpen(true);
                        if (!v.trim()) {
                          setPaciente(null);
                          handleChange("cpf_paciente", "");
                        }
                      }}
                      onFocus={handlePacienteFocus}
                      onBlur={handlePacienteBlur}
                      disabled={loading}
                    />
                    {pacOpen && pacQuery.trim().length >= 2 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-secondary-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                        {pacLoading ? (
                          <div className="flex items-center gap-2 p-3 text-secondary-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Buscando...
                          </div>
                        ) : pacOptions.length > 0 ? (
                          pacOptions.map((p) => (
                            <button
                              key={String((p as any).id ?? p.cpf ?? p.nome)}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-secondary-50 border-b last:border-0"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectPaciente(p)}
                            >
                              <div className="font-medium text-secondary-900">
                                {p.nome}
                              </div>
                              <div className="text-xs text-secondary-500">
                                CPF: {p.cpf}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-sm text-secondary-500">
                            Nenhum paciente encontrado
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {paciente && (
                    <div className="mt-2 p-2 bg-green-50 rounded-lg text-sm text-green-700">
                      <User className="inline h-4 w-4 mr-1" />
                      <strong>{paciente.nome}</strong> • CPF: {paciente.cpf}
                    </div>
                  )}
                  {errors.cpf_paciente && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.cpf_paciente}
                    </p>
                  )}
                </div>

                <div>
                  <label className="label">Médico *</label>
                  <select
                    className={`select ${errors.crm_medico ? "border-red-500" : ""}`}
                    value={form.crm_medico}
                    onChange={(e) => handleChange("crm_medico", e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Selecione o médico...</option>
                    {medicos.map((m) => (
                      <option key={String(m.crm)} value={String(m.crm)}>
                        {m.nome} (CRM {m.crm}){" "}
                        {m.especialidade ? `- ${m.especialidade}` : ""}
                      </option>
                    ))}
                  </select>
                  {errors.crm_medico && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.crm_medico}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="label">Tipo / Procedimento *</label>
                  <select
                    className={`select ${errors.tipo ? "border-red-500" : ""}`}
                    value={form.tipo}
                    onChange={(e) => handleChange("tipo", e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Selecione...</option>
                    {procedimentos.map((p) => (
                      <option key={p.nome} value={p.nome}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  {errors.tipo && (
                    <p className="text-sm text-red-500 mt-1">{errors.tipo}</p>
                  )}
                </div>
                <div>
                  <label className="label">Procedimentos Realizados</label>
                  <input
                    type="text"
                    className="input"
                    value={form.procedimentos || ""}
                    onChange={(e) =>
                      handleChange("procedimentos", e.target.value)
                    }
                    placeholder='Ex: "Aferição de PA, Avaliação física"'
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("anamnese")}
                  className="w-full flex items-center justify-between p-4 bg-secondary-50 hover:bg-secondary-100 transition"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-secondary-600" />
                    <span className="font-semibold text-secondary-900">
                      Anamnese
                    </span>
                    <span className="text-xs text-red-500">*</span>
                  </div>
                  {expandedSections.anamnese ? (
                    <ChevronUp className="h-5 w-5 text-secondary-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-secondary-400" />
                  )}
                </button>
                {expandedSections.anamnese && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Queixa Principal</label>
                        <input
                          type="text"
                          className="input"
                          value={form.queixa_principal || ""}
                          onChange={(e) =>
                            handleChange("queixa_principal", e.target.value)
                          }
                          placeholder="Motivo principal da consulta"
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <label className="label">Exame Físico</label>
                        <textarea
                          className="textarea min-h-[120px] resize-y leading-relaxed text-[15px]"
                          value={form.exame_fisico || ""}
                          onChange={(e) =>
                            handleChange("exame_fisico", e.target.value)
                          }
                          placeholder="Achados do exame físico..."
                          disabled={loading}
                        />
                      </div>
                      <div className="xl:col-span-2">
                        <label className="label">
                          História da Doença Atual (HDA)
                        </label>
                        <textarea
                          className="textarea min-h-[140px] resize-y leading-relaxed text-[15px]"
                          value={form.historia_doenca_atual || ""}
                          onChange={(e) =>
                            handleChange(
                              "historia_doenca_atual",
                              e.target.value,
                            )
                          }
                          placeholder="Evolução dos sintomas, tempo, fatores de melhora/piora..."
                          disabled={loading}
                        />
                      </div>
                      <div className="xl:col-span-2">
                        <label className="label">
                          Anamnese Completa *{" "}
                          <span className="text-xs text-secondary-500 ml-2">
                            (texto livre)
                          </span>
                        </label>
                        <textarea
                          className={`textarea min-h-[320px] md:min-h-[380px] resize-y leading-relaxed text-[15px] ${errors.anamnese ? "border-red-500" : ""}`}
                          value={form.anamnese}
                          onChange={(e) =>
                            handleChange("anamnese", e.target.value)
                          }
                          placeholder={`Registre aqui a anamnese completa...\n\n• Queixa principal\n• História da doença atual\n• Antecedentes\n• Exame físico\n• Impressão diagnóstica\n• Conduta`}
                          disabled={loading}
                        />
                        {errors.anamnese && (
                          <p className="text-sm text-red-500 mt-1">
                            {errors.anamnese}
                          </p>
                        )}
                        <p className="text-xs text-secondary-500 mt-1">
                          {form.anamnese?.length || 0} caracteres
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("diagnostico")}
                  className="w-full flex items-center justify-between p-4 bg-secondary-50 hover:bg-secondary-100 transition"
                >
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-secondary-600" />
                    <span className="font-semibold text-secondary-900">
                      Diagnóstico e Conduta
                    </span>
                  </div>
                  {expandedSections.diagnostico ? (
                    <ChevronUp className="h-5 w-5 text-secondary-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-secondary-400" />
                  )}
                </button>
                {expandedSections.diagnostico && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2">
                        <label className="label">Diagnóstico</label>
                        <input
                          type="text"
                          className="input"
                          value={form.diagnostico || ""}
                          onChange={(e) =>
                            handleChange("diagnostico", e.target.value)
                          }
                          placeholder="Diagnóstico ou hipótese"
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <label className="label">CID-10</label>
                        <input
                          type="text"
                          className="input"
                          value={form.cid || ""}
                          onChange={(e) =>
                            handleChange("cid", e.target.value.toUpperCase())
                          }
                          placeholder="Ex: J06.9"
                          maxLength={10}
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Conduta</label>
                      <textarea
                        className="textarea min-h-[140px] resize-y leading-relaxed text-[15px]"
                        value={form.conduta || ""}
                        onChange={(e) =>
                          handleChange("conduta", e.target.value)
                        }
                        placeholder="Orientações, encaminhamentos, plano terapêutico..."
                        disabled={loading}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("prescricoes")}
                  className="w-full flex items-center justify-between p-4 bg-secondary-50 hover:bg-secondary-100 transition"
                >
                  <div className="flex items-center gap-2">
                    <Pill className="h-5 w-5 text-secondary-600" />
                    <span className="font-semibold text-secondary-900">
                      Prescrições e Exames
                    </span>
                  </div>
                  {expandedSections.prescricoes ? (
                    <ChevronUp className="h-5 w-5 text-secondary-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-secondary-400" />
                  )}
                </button>
                {expandedSections.prescricoes && (
                  <div className="p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(form.houve_solicitacao_de_exame)}
                          onChange={(e) =>
                            handleChange(
                              "houve_solicitacao_de_exame",
                              e.target.checked,
                            )
                          }
                          className="h-4 w-4 rounded border-secondary-300 text-primary-600"
                          disabled={loading}
                        />
                        <span className="text-secondary-700">
                          Houve solicitação de exames
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(form.houve_prescricao_medicamentos)}
                          onChange={(e) =>
                            handleChange(
                              "houve_prescricao_medicamentos",
                              e.target.checked,
                            )
                          }
                          className="h-4 w-4 rounded border-secondary-300 text-primary-600"
                          disabled={loading}
                        />
                        <span className="text-secondary-700">
                          Houve prescrição de medicamentos
                        </span>
                      </label>
                    </div>
                    {form.houve_prescricao_medicamentos && (
                      <div>
                        <label className="label">Medicamentos Prescritos</label>
                        <textarea
                          className={`textarea min-h-[140px] resize-y leading-relaxed text-[15px] ${errors.medicamentos_prescrevidos ? "border-red-500" : ""}`}
                          value={form.medicamentos_prescrevidos || ""}
                          onChange={(e) =>
                            handleChange(
                              "medicamentos_prescrevidos",
                              e.target.value,
                            )
                          }
                          placeholder="Liste os medicamentos, posologia e orientações..."
                          disabled={loading}
                        />
                        {errors.medicamentos_prescrevidos && (
                          <p className="text-sm text-red-500 mt-1">
                            {errors.medicamentos_prescrevidos}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection("retorno")}
                  className="w-full flex items-center justify-between p-4 bg-secondary-50 hover:bg-secondary-100 transition"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-secondary-600" />
                    <span className="font-semibold text-secondary-900">
                      Retorno e Observações
                    </span>
                  </div>
                  {expandedSections.retorno ? (
                    <ChevronUp className="h-5 w-5 text-secondary-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-secondary-400" />
                  )}
                </button>
                {expandedSections.retorno && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Retorno em (dias)</label>
                        <input
                          type="number"
                          min="0"
                          className="input"
                          value={form.retorno_em ?? ""}
                          onChange={(e) =>
                            handleChange(
                              "retorno_em",
                              parseInt(e.target.value, 10) || undefined,
                            )
                          }
                          placeholder="Ex: 30"
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <label className="label">Data do Retorno</label>
                        <input
                          type="date"
                          className="input"
                          value={form.data_retorno || ""}
                          onChange={(e) =>
                            handleChange("data_retorno", e.target.value)
                          }
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">
                        Observações Internas{" "}
                        <span className="text-xs text-secondary-500">
                          (não vai para documentos)
                        </span>
                      </label>
                      <textarea
                        className="textarea min-h-[120px] resize-y leading-relaxed text-[15px]"
                        value={form.observacoes_internas || ""}
                        onChange={(e) =>
                          handleChange("observacoes_internas", e.target.value)
                        }
                        placeholder="Anotações internas..."
                        disabled={loading}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </form>

          <div className="pt-4 border-t flex-shrink-0">
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={safeClose}
                className="btn-secondary flex-1"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="consulta-form"
                className="btn-primary flex-1"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                {isEdit ? "Salvar Alterações" : "Cadastrar Consulta"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
