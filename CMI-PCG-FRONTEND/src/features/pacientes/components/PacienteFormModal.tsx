/**
 * Modal de Formulário de Paciente — theme-aware
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  LocateFixed,
  Building2,
  Heart,
  Search,
} from "lucide-react";
import type {
  Paciente,
  PacienteFormData,
  PacienteFormMode,
  EmpresaSelected,
  ConvenioSelected,
} from "../types";
import { INITIAL_PACIENTE_FORM } from "../types";
import { autocompleteAPI } from "@/services/autocomplete.api";

// ── Constantes / Helpers IMESC ──
const IMESC_CNPJ_DIGITS = "43054154000179";
function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}
function isImescCnpj(cnpj: string) {
  return onlyDigits(cnpj) === IMESC_CNPJ_DIGITS;
}
function normalizeSpaces(v: string) {
  return (v || "").trim().replace(/\s+/g, " ");
}
function formatProtocoloImesc(v: string) {
  const s = normalizeSpaces(v);
  const num = onlyDigits(s);
  if (!num) return s;
  return `CLI - ${num}`;
}
function isValidProtocoloImesc(v: string) {
  const s = normalizeSpaces(v);
  if (!s) return false;
  if (!s.toUpperCase().startsWith("CLI")) return false;
  return onlyDigits(s).length > 0;
}
function formatCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function buildEnderecoLegacy(form: PacienteFormData): string {
  const parts: string[] = [];
  if (form.logradouro) {
    let line = form.logradouro;
    if (form.numero) line += `, ${form.numero}`;
    if (form.complemento) line += ` (${form.complemento})`;
    parts.push(line);
  }
  if (form.bairro) parts.push(form.bairro);
  if (form.cidade || form.uf)
    parts.push([form.cidade, form.uf].filter(Boolean).join(" - "));
  return parts.join(", ") || form.endereco;
}

// ── InlinePicker ──
interface PickerProps<T> {
  label: string;
  placeholder: string;
  selected: T | null;
  onSelect: (item: T) => void;
  onClear: () => void;
  load: (q: string) => Promise<T[]>;
  renderItem: (item: T) => { title: string; subtitle: string };
  icon: React.ReactNode;
  accentCls: string;
}

function InlinePicker<T>({
  label,
  placeholder,
  selected,
  onSelect,
  onClear,
  load,
  renderItem,
  icon,
  accentCls,
}: PickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || query.length < 2) {
      setItems([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await load(query);
        if (alive) setItems(data);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, query, load]);

  const selectedRender = selected ? renderItem(selected) : null;

  if (selected && selectedRender) {
    return (
      <div className={`p-4 rounded-xl border-2 border-dashed ${accentCls}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-bg-200">{icon}</div>
            <div className="min-w-0">
              <p className="font-semibold text-text-100 truncate">
                {selectedRender.title}
              </p>
              <p className="text-sm text-text-200 truncate">
                {selectedRender.subtitle}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setOpen(true)}
            >
              Trocar
            </button>
            <button
              type="button"
              className="btn-ghost text-sm text-danger"
              onClick={onClear}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-bg-300"
            >
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-200" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  className="input pl-10"
                  autoFocus
                />
              </div>
              <PickerResults
                loading={loading}
                items={items}
                query={query}
                renderItem={renderItem}
                onSelect={(item) => {
                  onSelect(item);
                  setOpen(false);
                  setQuery("");
                }}
              />
              <button
                type="button"
                className="btn-ghost text-sm w-full mt-2"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                }}
              >
                Cancelar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border-2 border-dashed ${accentCls}`}>
      <p className="text-sm font-medium text-text-200 mb-3">{label}</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-200" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="input pl-10"
        />
      </div>
      <AnimatePresence>
        {open && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-3"
          >
            <PickerResults
              loading={loading}
              items={items}
              query={query}
              renderItem={renderItem}
              onSelect={(item) => {
                onSelect(item);
                setOpen(false);
                setQuery("");
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {open && query.length < 2 && query.length > 0 && (
        <p className="text-xs text-text-200 mt-2">
          Digite pelo menos 2 caracteres...
        </p>
      )}
    </div>
  );
}

function PickerResults<T>({
  loading,
  items,
  query,
  renderItem,
  onSelect,
}: {
  loading: boolean;
  items: T[];
  query: string;
  renderItem: (item: T) => { title: string; subtitle: string };
  onSelect: (item: T) => void;
}) {
  if (loading)
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary-100" />
      </div>
    );
  if (items.length === 0 && query.length >= 2)
    return (
      <p className="text-sm text-text-200 py-3 text-center">
        Nenhum resultado encontrado
      </p>
    );
  return (
    <div className="max-h-48 overflow-y-auto space-y-1">
      {items.map((item, idx) => {
        const r = renderItem(item);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(item)}
            className="w-full text-left p-3 rounded-lg bg-bg-100 hover:bg-bg-200 border border-bg-300 transition-colors"
          >
            <p className="font-medium text-text-100 truncate">{r.title}</p>
            <p className="text-sm text-text-200 truncate">{r.subtitle}</p>
          </button>
        );
      })}
    </div>
  );
}

// ── Props ──
interface PacienteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Paciente>) => Promise<void>;
  mode: PacienteFormMode;
  initialData?: Paciente | null;
  saving?: boolean;
}

// ── Component ──
export function PacienteFormModal({
  isOpen,
  onClose,
  onSubmit,
  mode,
  initialData,
  saving = false,
}: PacienteFormModalProps) {
  const [formData, setFormData] = useState<PacienteFormData>(
    INITIAL_PACIENTE_FORM,
  );
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isImesc = useMemo(() => {
    if (!formData.vinculado_a_convenio || !formData.convenio_selecionado)
      return false;
    return isImescCnpj(formData.convenio_selecionado.cnpj);
  }, [formData.vinculado_a_convenio, formData.convenio_selecionado]);

  useEffect(() => {
    if (initialData && mode === "edit") {
      setFormData({
        nome: initialData.nome || "",
        cpf: initialData.cpf || "",
        data_de_nascimento: initialData.data_de_nascimento || "",
        sexo: (initialData.sexo as "M" | "F") || "",
        numero_de_contato: String(initialData.numero_de_contato || ""),
        email: initialData.email || "",
        cep: initialData.cep || "",
        logradouro: initialData.logradouro || "",
        numero: initialData.numero || "",
        complemento: initialData.complemento || "",
        bairro: initialData.bairro || "",
        cidade: initialData.cidade || "",
        uf: initialData.uf || "",
        endereco: initialData.endereco || "",
        vinculado_a_empresa: !!initialData.vinculado_a_empresa,
        cnpj_empresa: initialData.cnpj_empresa || "",
        empresa_selecionada: initialData.empresa
          ? {
              id: initialData.empresa.id,
              nome: initialData.empresa.nome,
              cnpj: initialData.empresa.cnpj,
            }
          : null,
        vinculado_a_convenio: !!initialData.vinculado_a_convenio,
        cnpj_convenio: initialData.cnpj_convenio || "",
        convenio_selecionado: initialData.convenio
          ? {
              id: initialData.convenio.id,
              nome: initialData.convenio.nome,
              cnpj: initialData.convenio.cnpj,
            }
          : null,
        protocolo_imesc: initialData.protocolo_imesc || "",
      });
    } else {
      setFormData(INITIAL_PACIENTE_FORM);
    }
    setCepError(null);
    setFormError(null);
  }, [initialData, mode, isOpen]);

  const updateForm = <K extends keyof PacienteFormData>(
    key: K,
    value: PacienteFormData[K],
  ) => setFormData((prev) => ({ ...prev, [key]: value }));

  const loadEmpresas = useCallback(async (q: string) => {
    const data = await autocompleteAPI.empresas(q, 10);
    return data.map((e) => ({ id: e.id, nome: e.nome, cnpj: e.cnpj }));
  }, []);
  const loadConvenios = useCallback(async (q: string) => {
    const data = await autocompleteAPI.convenios(q, 10);
    return data.map((c) => ({
      id: c.id,
      nome: c.nome,
      cnpj: c.cnpj,
      emite_guia: c.emite_guia,
    }));
  }, []);

  const buscarCep = async () => {
    const digits = onlyDigits(formData.cep);
    setCepError(null);
    if (digits.length === 0) return;
    if (digits.length !== 8) {
      setCepError("CEP deve ter 8 dígitos.");
      return;
    }
    try {
      setCepLoading(true);
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) {
        setCepError("Erro ao consultar CEP.");
        return;
      }
      const data = await res.json();
      if (data?.erro) {
        setCepError("CEP não encontrado.");
        return;
      }
      setFormData((prev) => ({
        ...prev,
        cep: digits,
        logradouro: (data.logradouro || "").trim(),
        bairro: (data.bairro || "").trim(),
        cidade: (data.localidade || "").trim(),
        uf: (data.uf || "").trim(),
      }));
    } catch {
      setCepError("Falha ao consultar CEP.");
    } finally {
      setCepLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (isImesc && !isValidProtocoloImesc(formData.protocolo_imesc)) {
      setFormError(
        "Para convênio IMESC, o 'Protocolo IMESC' é obrigatório (formato: CLI - 123)",
      );
      return;
    }
    const payload: Partial<Paciente> = {
      nome: formData.nome.trim(),
      cpf: formData.cpf,
      data_de_nascimento: formData.data_de_nascimento,
      sexo: formData.sexo
        ? (formData.sexo.toUpperCase() as "M" | "F")
        : undefined,
      numero_de_contato: formData.numero_de_contato || undefined,
      email: formData.email.trim() || undefined,
      cep: onlyDigits(formData.cep) || undefined,
      logradouro: formData.logradouro.trim() || undefined,
      numero: formData.numero.trim() || undefined,
      complemento: formData.complemento.trim() || undefined,
      bairro: formData.bairro.trim() || undefined,
      cidade: formData.cidade.trim() || undefined,
      uf: formData.uf.toUpperCase().trim() || undefined,
      endereco: buildEnderecoLegacy(formData) || undefined,
      vinculado_a_empresa: formData.vinculado_a_empresa,
      cnpj_empresa: formData.empresa_selecionada?.cnpj || undefined,
      vinculado_a_convenio: formData.vinculado_a_convenio,
      cnpj_convenio: formData.convenio_selecionado?.cnpj || undefined,
      protocolo_imesc: isImesc
        ? formatProtocoloImesc(formData.protocolo_imesc)
        : undefined,
    };
    await onSubmit(payload);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg-100 rounded-2xl border border-bg-300 shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col"
              style={{ boxShadow: "var(--shadow-md)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-bg-300 bg-bg-200">
                <h3 className="text-xl sm:text-2xl font-bold text-text-100">
                  {mode === "create" ? "Novo Paciente" : "Editar Paciente"}
                </h3>
                <button onClick={onClose} className="btn-icon btn-ghost">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form */}
              <form
                onSubmit={handleSubmit}
                className="flex-1 overflow-y-auto p-4 sm:p-6"
              >
                <div className="space-y-6">
                  {formError && (
                    <div className="p-4 rounded-xl border-semantic-danger bg-danger-light text-danger text-sm">
                      {formError}
                    </div>
                  )}

                  {/* Dados Pessoais */}
                  <section>
                    <h4 className="text-lg font-semibold text-text-100 mb-4 pb-2 border-b border-bg-300">
                      Dados Pessoais
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="label">Nome Completo *</label>
                        <input
                          type="text"
                          value={formData.nome}
                          onChange={(e) => updateForm("nome", e.target.value)}
                          className="input"
                          placeholder="Nome completo"
                          required
                        />
                      </div>
                      <div>
                        <label className="label">
                          CPF {mode === "create" ? "*" : ""}
                        </label>
                        <input
                          type="text"
                          value={formData.cpf}
                          onChange={(e) => updateForm("cpf", e.target.value)}
                          className="input"
                          placeholder="000.000.000-00"
                          required={mode === "create"}
                        />
                      </div>
                      <div>
                        <label className="label">
                          Nascimento {mode === "create" ? "*" : ""}
                        </label>
                        <input
                          type="date"
                          value={formData.data_de_nascimento}
                          onChange={(e) =>
                            updateForm("data_de_nascimento", e.target.value)
                          }
                          className="input"
                          required={mode === "create"}
                        />
                      </div>
                      <div>
                        <label className="label">Sexo</label>
                        <select
                          value={formData.sexo}
                          onChange={(e) =>
                            updateForm("sexo", e.target.value as any)
                          }
                          className="select"
                        >
                          <option value="">Não informado</option>
                          <option value="M">Masculino</option>
                          <option value="F">Feminino</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Telefone</label>
                        <input
                          type="text"
                          value={formData.numero_de_contato}
                          onChange={(e) =>
                            updateForm("numero_de_contato", e.target.value)
                          }
                          className="input"
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">Email</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => updateForm("email", e.target.value)}
                          className="input"
                          placeholder="email@exemplo.com"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Endereço */}
                  <section>
                    <h4 className="text-lg font-semibold text-text-100 mb-4 pb-2 border-b border-bg-300">
                      Endereço
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="sm:col-span-2">
                        <label className="label">CEP</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={formatCep(formData.cep)}
                            onChange={(e) => {
                              setCepError(null);
                              updateForm("cep", e.target.value);
                            }}
                            onBlur={buscarCep}
                            className="input flex-1"
                            placeholder="00000-000"
                            inputMode="numeric"
                          />
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={buscarCep}
                            disabled={cepLoading}
                          >
                            {cepLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <LocateFixed className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {cepError && (
                          <p className="text-xs text-danger mt-1">{cepError}</p>
                        )}
                      </div>
                      <div className="sm:col-span-2 lg:col-span-2">
                        <label className="label">Logradouro</label>
                        <input
                          type="text"
                          value={formData.logradouro}
                          onChange={(e) =>
                            updateForm("logradouro", e.target.value)
                          }
                          className="input"
                          placeholder="Rua / Avenida"
                        />
                      </div>
                      <div>
                        <label className="label">Número</label>
                        <input
                          type="text"
                          value={formData.numero}
                          onChange={(e) => updateForm("numero", e.target.value)}
                          className="input"
                          placeholder="123"
                        />
                      </div>
                      <div>
                        <label className="label">Complemento</label>
                        <input
                          type="text"
                          value={formData.complemento}
                          onChange={(e) =>
                            updateForm("complemento", e.target.value)
                          }
                          className="input"
                          placeholder="Apto / Bloco"
                        />
                      </div>
                      <div>
                        <label className="label">Bairro</label>
                        <input
                          type="text"
                          value={formData.bairro}
                          onChange={(e) => updateForm("bairro", e.target.value)}
                          className="input"
                          placeholder="Bairro"
                        />
                      </div>
                      <div>
                        <label className="label">Cidade</label>
                        <input
                          type="text"
                          value={formData.cidade}
                          onChange={(e) => updateForm("cidade", e.target.value)}
                          className="input"
                          placeholder="Cidade"
                        />
                      </div>
                      <div>
                        <label className="label">UF</label>
                        <input
                          type="text"
                          value={formData.uf}
                          onChange={(e) =>
                            updateForm("uf", e.target.value.toUpperCase())
                          }
                          className="input"
                          placeholder="SP"
                          maxLength={2}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Vínculos */}
                  <section>
                    <h4 className="text-lg font-semibold text-text-100 mb-4 pb-2 border-b border-bg-300">
                      Vínculos
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input
                            type="checkbox"
                            checked={formData.vinculado_a_empresa}
                            onChange={(e) => {
                              updateForm(
                                "vinculado_a_empresa",
                                e.target.checked,
                              );
                              if (!e.target.checked) {
                                updateForm("empresa_selecionada", null);
                                updateForm("cnpj_empresa", "");
                              }
                            }}
                            className="w-5 h-5 rounded border-bg-300 text-primary-100 focus:ring-primary-200"
                          />
                          <span className="font-medium text-text-100">
                            Vinculado a empresa
                          </span>
                        </label>
                        {formData.vinculado_a_empresa && (
                          <InlinePicker<EmpresaSelected>
                            label="Selecione a empresa"
                            placeholder="Nome ou CNPJ..."
                            selected={formData.empresa_selecionada}
                            onSelect={(emp) => {
                              updateForm("empresa_selecionada", emp);
                              updateForm("cnpj_empresa", emp.cnpj);
                            }}
                            onClear={() => {
                              updateForm("empresa_selecionada", null);
                              updateForm("cnpj_empresa", "");
                            }}
                            load={loadEmpresas}
                            renderItem={(e) => ({
                              title: e.nome,
                              subtitle: `CNPJ: ${e.cnpj}`,
                            })}
                            icon={
                              <Building2 className="h-5 w-5 text-primary-100" />
                            }
                            accentCls="border-primary-200 bg-primary-300"
                          />
                        )}
                      </div>

                      <div>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input
                            type="checkbox"
                            checked={formData.vinculado_a_convenio}
                            onChange={(e) => {
                              updateForm(
                                "vinculado_a_convenio",
                                e.target.checked,
                              );
                              if (!e.target.checked) {
                                updateForm("convenio_selecionado", null);
                                updateForm("cnpj_convenio", "");
                                updateForm("protocolo_imesc", "");
                              }
                            }}
                            className="w-5 h-5 rounded border-bg-300 text-primary-100 focus:ring-primary-200"
                          />
                          <span className="font-medium text-text-100">
                            Vinculado a convênio
                          </span>
                        </label>
                        {formData.vinculado_a_convenio && (
                          <InlinePicker<ConvenioSelected>
                            label="Selecione o convênio"
                            placeholder="Nome ou CNPJ..."
                            selected={formData.convenio_selecionado}
                            onSelect={(conv) => {
                              updateForm("convenio_selecionado", conv);
                              updateForm("cnpj_convenio", conv.cnpj);
                            }}
                            onClear={() => {
                              updateForm("convenio_selecionado", null);
                              updateForm("cnpj_convenio", "");
                              updateForm("protocolo_imesc", "");
                            }}
                            load={loadConvenios}
                            renderItem={(c) => ({
                              title: c.nome,
                              subtitle: `CNPJ: ${c.cnpj}`,
                            })}
                            icon={<Heart className="h-5 w-5 text-danger" />}
                            accentCls="border-danger/20 bg-danger-light"
                          />
                        )}
                        {formData.vinculado_a_convenio && isImesc && (
                          <div className="mt-4 p-4 rounded-xl bg-warning-light border-semantic-warning">
                            <label className="label text-warning">
                              Protocolo IMESC *
                            </label>
                            <input
                              type="text"
                              value={formData.protocolo_imesc}
                              onChange={(e) =>
                                updateForm("protocolo_imesc", e.target.value)
                              }
                              onBlur={() =>
                                updateForm(
                                  "protocolo_imesc",
                                  formatProtocoloImesc(
                                    formData.protocolo_imesc,
                                  ),
                                )
                              }
                              className="input"
                              placeholder="CLI - 123"
                              required
                            />
                            <p className="text-xs text-warning mt-2">
                              Convênio IMESC detectado. Formato:{" "}
                              <strong>CLI - 123</strong>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              </form>

              {/* Footer */}
              <div className="flex gap-3 p-4 sm:p-6 border-t border-bg-300 bg-bg-200">
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
                  onClick={handleSubmit}
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : mode === "create" ? (
                    "Cadastrar"
                  ) : (
                    "Salvar"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default PacienteFormModal;
