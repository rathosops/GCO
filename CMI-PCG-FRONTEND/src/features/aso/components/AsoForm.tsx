// src/features/aso/components/AsoForm.tsx

import { useCallback, useState } from "react";
import {
  FileDown,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  RotateCcw,
  Save,
  Eye,
  ShieldAlert,
  Building2,
} from "lucide-react";
import EntityPicker from "@/components/common/EntityPicker";
import {
  autocompleteAPI,
  type AutocompletePaciente,
  type AutocompleteEmpresa,
} from "@/services/autocomplete.api";
import { medicosAPI } from "@/services/api";
import { useToast } from "@/components/feedback/toast";
import { formatCpf, formatCnpj } from "@/utils/formatters";
import { asoAPI, downloadBlob, extractBlobError } from "../api/aso.api";
import type { Medico } from "@/types";
import {
  type AsoFormData,
  type RiscosOcupacionais,
  type NormasRegulamentadoras,
  TIPOS_EXAME,
  CONCLUSOES,
  NR_OPTIONS,
  RISCOS_KEYS,
  RISCOS_LABELS,
  NRS_KEYS,
  NRS_LABELS,
  EMPTY_FORM,
} from "../types/aso.types";

// ============================================
// Sub-components
// ============================================

function SectionCard({
  title,
  icon: Icon,
  hint,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-primary-100 shrink-0" />}
          <h3 className="font-semibold text-text-100">{title}</h3>
        </div>
        {hint && (
          <span className="text-xs text-text-200 bg-bg-200 px-2 py-0.5 rounded-full shrink-0">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ExameTagInput({
  exames,
  onChange,
}: {
  exames: string[];
  onChange: (exames: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const val = input.trim();
    if (val && !exames.includes(val)) {
      onChange([...exames, val]);
    }
    setInput("");
  };

  const remove = (idx: number) => {
    onChange(exames.filter((_, i) => i !== idx));
  };

  const suggestions = [
    "Hemograma",
    "Audiometria",
    "Espirometria",
    "Acuidade Visual",
    "Glicemia",
    "ECG",
    "EAS",
    "Raio-X Tórax",
  ];
  const available = suggestions.filter((s) => !exames.includes(s));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Digitar nome do exame..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={add}
          disabled={!input.trim()}
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>

      {/* Quick-add suggestions */}
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((s) => (
            <button
              key={s}
              type="button"
              className="text-xs px-2.5 py-1 rounded-full border border-dashed border-bg-300
                         text-text-200 hover:border-primary-200 hover:text-primary-100
                         hover:bg-primary-100/5 transition-all"
              onClick={() => onChange([...exames, s])}
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {/* Selected exams */}
      {exames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {exames.map((ex, idx) => (
            <span
              key={idx}
              className="badge-primary flex items-center gap-1.5 px-3 py-1"
            >
              {ex}
              <button
                type="button"
                onClick={() => remove(idx)}
                className="hover:text-danger transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

interface AsoFormProps {
  onSaved?: () => void;
}

export default function AsoForm({ onSaved }: AsoFormProps) {
  const toast = useToast();
  const [form, setForm] = useState<AsoFormData>({ ...EMPTY_FORM });
  const [loading, setLoading] = useState<"pdf" | "save" | null>(null);

  // --- Updaters ---
  const set = <K extends keyof AsoFormData>(key: K, val: AsoFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const setRisco = (key: keyof RiscosOcupacionais, val: string) =>
    setForm((prev) => ({ ...prev, riscos: { ...prev.riscos, [key]: val } }));

  const setNr = (key: keyof NormasRegulamentadoras, val: string) =>
    setForm((prev) => ({ ...prev, nrs: { ...prev.nrs, [key]: val } }));

  // --- Entity loaders ---
  const loadPacientes = useCallback(
    async (q: string) => {
      if (form.empresa) {
        return autocompleteAPI.pacientes(q, {
          empresa_id: (form.empresa as any).id,
          limit: 10,
        });
      }
      return autocompleteAPI.pacientes(q, { limit: 10 });
    },
    [form.empresa],
  );

  const loadEmpresas = useCallback(
    (q: string) => autocompleteAPI.empresas(q, 10),
    [],
  );

  const loadMedicos = useCallback(
    async (q: string) => medicosAPI.getAll({ nome: q }),
    [],
  );

  // --- Validação ---
  const validate = (): string | null => {
    if (!form.paciente) return "Selecione o paciente.";
    if (!form.empresa) return "Selecione a empresa.";
    if (!form.medico) return "Selecione o médico.";
    if (!form.funcao_do_paciente.trim()) return "Informe a função do paciente.";
    if (!form.tipo_de_exame.exame) return "Selecione o tipo de exame.";
    if (!form.conclusao.status) return "Selecione a conclusão médica.";
    return null;
  };

  const isValid = !validate();

  // --- Submit: salvar + gerar PDF ---
  const handleGerarPdf = async () => {
    const err = validate();
    if (err) {
      toast.warning(err);
      return;
    }

    setLoading("pdf");
    try {
      if (form.salvar_aso) {
        const blob = await asoAPI.criarComPdf(form);
        const nome = form.paciente!.nome.replace(/\s+/g, "_");
        downloadBlob(blob, `aso_${nome}.pdf`);
        toast.success("ASO salvo e PDF gerado!");
        onSaved?.();
      } else {
        const blob = await asoAPI.gerarPdfPreview(form);
        const nome = form.paciente!.nome.replace(/\s+/g, "_");
        downloadBlob(blob, `aso_preview_${nome}.pdf`);
        toast.success("PDF gerado (preview)!");
      }
    } catch (error) {
      toast.error(await extractBlobError(error));
    } finally {
      setLoading(null);
    }
  };

  // --- Submit: só salvar ---
  const handleSalvar = async () => {
    const err = validate();
    if (err) {
      toast.warning(err);
      return;
    }

    setLoading("save");
    try {
      await asoAPI.criar({ ...form, salvar_aso: true });
      toast.success("ASO salvo com sucesso!");
      setForm({ ...EMPTY_FORM });
      onSaved?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Erro ao salvar ASO.");
    } finally {
      setLoading(null);
    }
  };

  const handleReset = () => {
    setForm({ ...EMPTY_FORM });
    toast.info("Formulário limpo.");
  };

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-text-200">
            Preencha os campos obrigatórios (*) para gerar o Atestado de Saúde
            Ocupacional
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={handleReset}
            disabled={!!loading}
          >
            <RotateCcw className="h-4 w-4" /> Limpar
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleSalvar}
            disabled={!!loading || !isValid}
          >
            {loading === "save" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleGerarPdf}
            disabled={!!loading || !isValid}
          >
            {loading === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {form.salvar_aso ? "Salvar & Gerar PDF" : "Preview PDF"}
          </button>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COL 1 - Entidades + Info */}
        <div className="space-y-6">
          {/* Empresa */}
          <SectionCard title="Empresa" hint="Obrigatório">
            {form.empresa && (form.paciente as any)?.empresa_id ? (
              // Paciente já está vinculado — exibir info sem picker redundante
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3 p-3 bg-bg-200 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-success-light shrink-0">
                      <Building2 className="h-4 w-4 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-100 truncate">
                        {form.empresa.nome}
                      </p>
                      <p className="text-xs text-text-200">
                        {formatCnpj(String(form.empresa.cnpj))}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-text-200 shrink-0"
                    onClick={() => set("empresa", null)}
                    title="Selecionar outra empresa"
                  >
                    Trocar
                  </button>
                </div>
                <p className="text-xs text-text-200 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-success" />
                  Empresa vinculada ao paciente — pré-preenchida
                  automaticamente.
                </p>
              </div>
            ) : (
              // Paciente sem vínculo ou empresa selecionada manualmente
              <EntityPicker<AutocompleteEmpresa>
                title="Empresa vinculada"
                placeholder="Buscar por nome ou CNPJ..."
                selected={form.empresa as AutocompleteEmpresa | null}
                onSelect={(emp) => {
                  set("empresa", {
                    nome: emp.nome,
                    cnpj: emp.cnpj_raw,
                    ...(emp as any),
                  });
                  if (form.paciente) set("paciente", null);
                }}
                onClear={() => {
                  set("empresa", null);
                  set("paciente", null);
                }}
                load={loadEmpresas}
                renderItem={(e) => ({
                  title: e.nome,
                  subtitle: formatCnpj(String(e.cnpj_raw)),
                  right: `${e.total_pacientes} pac.`,
                })}
                minChars={2}
              />
            )}
          </SectionCard>

          {/* Paciente */}
          <SectionCard title="Trabalhador" hint="Obrigatório">
            <EntityPicker<AutocompletePaciente>
              title="Paciente / Trabalhador"
              placeholder="Buscar por nome ou CPF..."
              selected={form.paciente as AutocompletePaciente | null}
              onSelect={(pac) => {
                set("paciente", {
                  nome: pac.nome,
                  cpf: pac.cpf_raw,
                  ...(pac as any),
                });
                if (pac.empresa_id && pac.empresa_nome && !form.empresa) {
                  set("empresa", {
                    nome: pac.empresa_nome,
                    cnpj: (pac as any).cnpj_empresa_raw ?? "",
                    id: pac.empresa_id,
                  } as any);
                }
              }}
              onClear={() => set("paciente", null)}
              load={loadPacientes}
              renderItem={(p) => ({
                title: p.nome,
                subtitle: formatCpf(String(p.cpf_raw)),
                right: p.empresa_nome || "Particular",
              })}
              minChars={2}
            />
            {form.paciente && !form.empresa && (
              <div className="alert-warning mt-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="text-sm">
                  Paciente precisa estar vinculado a uma empresa para gerar ASO.
                </span>
              </div>
            )}
          </SectionCard>

          {/* Médico */}
          <SectionCard title="Médico Examinador" hint="Obrigatório">
            <EntityPicker<Medico>
              title="Médico responsável"
              placeholder="Buscar por nome..."
              selected={form.medico as Medico | null}
              onSelect={(m) =>
                set("medico", { nome: m.nome, crm: m.crm, ...(m as any) })
              }
              onClear={() => set("medico", null)}
              load={loadMedicos}
              renderItem={(m) => ({
                title: m.nome,
                subtitle: `CRM ${m.crm}`,
                right: m.especialidade || "",
              })}
              minChars={1}
            />
          </SectionCard>

          {/* Informações do Exame */}
          <SectionCard title="Informações do Exame" hint="Obrigatório">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Função do Paciente *</label>
                  <input
                    className="input"
                    placeholder="Ex: Auxiliar Administrativo"
                    value={form.funcao_do_paciente}
                    onChange={(e) => set("funcao_do_paciente", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Setor</label>
                  <input
                    className="input"
                    placeholder="Ex: Administrativo, Produção..."
                    value={form.setor}
                    onChange={(e) => set("setor", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">Tipo de Exame *</label>
                <select
                  className="select"
                  value={form.tipo_de_exame.exame}
                  onChange={(e) =>
                    set("tipo_de_exame", { exame: e.target.value })
                  }
                >
                  <option value="">Selecione o tipo de exame...</option>
                  {TIPOS_EXAME.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Conclusão Médica *</label>
                <div className="flex flex-wrap gap-2">
                  {CONCLUSOES.map((c) => {
                    const isSelected = form.conclusao.status === c;
                    const styles = {
                      APTO: {
                        active:
                          "bg-green-50 border-green-400 text-green-800 shadow-sm shadow-green-100",
                        icon: CheckCircle,
                      },
                      INAPTO: {
                        active:
                          "bg-red-50 border-red-400 text-red-800 shadow-sm shadow-red-100",
                        icon: AlertCircle,
                      },
                      "APTO COM RESTRIÇÕES": {
                        active:
                          "bg-amber-50 border-amber-400 text-amber-800 shadow-sm shadow-amber-100",
                        icon: ShieldAlert,
                      },
                    };
                    const s = styles[c];
                    const Icon = s.icon;

                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set("conclusao", { status: c })}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all
                          ${isSelected ? s.active : "bg-bg-100 border-bg-300 text-text-200 hover:border-primary-200"}`}
                      >
                        <Icon className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Restrições (conditional) */}
              {form.conclusao.status === "APTO COM RESTRIÇÕES" && (
                <div>
                  <label className="label">Descrição das Restrições *</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="Descreva as restrições ocupacionais do trabalhador..."
                    value={form.restricoes}
                    onChange={(e) => set("restricoes", e.target.value)}
                  />
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* COL 2 - Detalhes clínicos */}
        <div className="space-y-6">
          {/* Riscos Ocupacionais */}
          <SectionCard title="Riscos Ocupacionais" hint="NR-7 §7.5.19.1-III">
            <div className="space-y-3">
              {RISCOS_KEYS.map((key) => (
                <div key={key}>
                  <label className="label">{RISCOS_LABELS[key]}</label>
                  <input
                    className="input"
                    placeholder={`Descreva riscos ${RISCOS_LABELS[key].toLowerCase()}s (se houver)...`}
                    value={form.riscos[key]}
                    onChange={(e) => setRisco(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Exames Complementares */}
          <SectionCard title="Exames Complementares" hint="NR-7 §7.5.19.1-IV">
            <ExameTagInput
              exames={form.exames_solicitados.exames}
              onChange={(exames) => set("exames_solicitados", { exames })}
            />
          </SectionCard>

          {/* Normas Regulamentadoras */}
          <SectionCard title="Normas Regulamentadoras">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {NRS_KEYS.map((key) => (
                <div key={key}>
                  <label className="label">{NRS_LABELS[key]}</label>
                  <select
                    className="select"
                    value={form.nrs[key]}
                    onChange={(e) => setNr(key, e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {NR_OPTIONS.filter(Boolean).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label className="label">Manipulação de Alimentos</label>
              <select
                className="select"
                value={form.manipulacao_de_alimentos}
                onChange={(e) =>
                  set("manipulacao_de_alimentos", e.target.value)
                }
              >
                <option value="">Não se aplica</option>
                <option value="Apto">Apto</option>
                <option value="Inapto">Inapto</option>
              </select>
            </div>
          </SectionCard>

          {/* Observações */}
          <SectionCard title="Observações">
            <textarea
              className="textarea"
              rows={3}
              placeholder="Observações adicionais (opcional)..."
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </SectionCard>

          {/* Opções */}
          <SectionCard title="Opções de Salvamento">
            <label className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-bg-200 transition-colors">
              <input
                type="checkbox"
                checked={form.salvar_aso}
                onChange={(e) => set("salvar_aso", e.target.checked)}
                className="w-5 h-5 rounded border-bg-300 text-primary-100
                           focus:ring-primary-200 cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium text-text-100">
                  Salvar ASO no sistema
                </p>
                <p className="text-xs text-text-200">
                  Registra o atestado para histórico e consulta futura
                  (recomendado)
                </p>
              </div>
            </label>
          </SectionCard>
        </div>
      </div>

      {/* Botão mobile fixo */}
      <div className="lg:hidden sticky bottom-4">
        <button
          type="button"
          className="btn-primary w-full py-3"
          onClick={handleGerarPdf}
          disabled={!!loading || !isValid}
        >
          {loading === "pdf" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <FileDown className="h-5 w-5" />
          )}
          {loading === "pdf" ? "Gerando..." : "Gerar ASO em PDF"}
        </button>
      </div>
    </div>
  );
}
