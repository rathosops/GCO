/**
 * Modal de criação/edição de empresa
 * Organizado em seções colapsáveis para não sobrecarregar
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Phone,
  UserCheck,
  FileText,
} from "lucide-react";
import { cepAPI } from "@/services/api";
import type { Empresa, EmpresaFormData, INITIAL_EMPRESA_FORM } from "../types";
import { UF_OPTIONS } from "../types";

// ── Helpers ──────────────────────────────────────────────────
const formatCNPJ = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

const formatCEP = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
};

// ── Section Toggle ───────────────────────────────────────────
function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: typeof Building2;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <Icon className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-semibold text-slate-700 flex-1">
          {title}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EmpresaFormData) => Promise<void>;
  initialData?: Empresa | null;
  saving: boolean;
}

export function EmpresaFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  saving,
}: Props) {
  const isEdit = !!initialData;

  const [form, setForm] = useState<EmpresaFormData>({
    cnpj: "",
    razao_social: "",
    nome: "",
    cnae: "",
    cnae_descricao: "",
    grau_risco: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    numero_para_contato: "",
    email: "",
    contato_rh_nome: "",
    contato_rh_telefone: "",
    contato_rh_email: "",
    inscricao_estadual: "",
    inscricao_municipal: "",
    observacoes: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof EmpresaFormData, string>>
  >({});
  const [cepLoading, setCepLoading] = useState(false);

  // Populate on edit
  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setForm({
        cnpj: initialData.cnpj || "",
        razao_social: initialData.razao_social || "",
        nome: initialData.nome || "",
        cnae: initialData.cnae || "",
        cnae_descricao: initialData.cnae_descricao || "",
        grau_risco: initialData.grau_risco?.toString() || "",
        cep: initialData.cep || "",
        logradouro: initialData.logradouro || "",
        numero: initialData.numero || "",
        complemento: initialData.complemento || "",
        bairro: initialData.bairro || "",
        cidade: initialData.cidade || "",
        uf: initialData.uf || "",
        numero_para_contato: initialData.numero_para_contato?.toString() || "",
        email: initialData.email || "",
        contato_rh_nome: initialData.contato_rh_nome || "",
        contato_rh_telefone: initialData.contato_rh_telefone?.toString() || "",
        contato_rh_email: initialData.contato_rh_email || "",
        inscricao_estadual: initialData.inscricao_estadual || "",
        inscricao_municipal: initialData.inscricao_municipal || "",
        observacoes: initialData.observacoes || "",
      });
    } else {
      setForm({
        cnpj: "",
        razao_social: "",
        nome: "",
        cnae: "",
        cnae_descricao: "",
        grau_risco: "",
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        uf: "",
        numero_para_contato: "",
        email: "",
        contato_rh_nome: "",
        contato_rh_telefone: "",
        contato_rh_email: "",
        inscricao_estadual: "",
        inscricao_municipal: "",
        observacoes: "",
      });
    }
    setErrors({});
  }, [isOpen, initialData]);

  // CEP lookup
  const handleCepBlur = async () => {
    const digits = form.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      setCepLoading(true);
      const addr = await cepAPI.lookup(digits);
      setForm((p) => ({
        ...p,
        logradouro: addr.logradouro || p.logradouro,
        bairro: addr.bairro || p.bairro,
        cidade: addr.cidade || p.cidade,
        uf: addr.uf || p.uf,
      }));
    } catch {
      /* silently ignore */
    } finally {
      setCepLoading(false);
    }
  };

  const set = (field: keyof EmpresaFormData, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.cnpj || form.cnpj.replace(/\D/g, "").length !== 14)
      e.cnpj = "CNPJ inválido (14 dígitos)";
    if (!form.nome.trim()) e.nome = "Nome fantasia é obrigatório";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Email inválido";
    if (form.grau_risco && !["1", "2", "3", "4"].includes(form.grau_risco))
      e.grau_risco = "Deve ser 1, 2, 3 ou 4";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (validate()) await onSubmit(form);
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
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-xl">
                <Building2 className="h-5 w-5 text-cyan-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {isEdit ? "Editar Empresa" : "Nova Empresa"}
              </h3>
            </div>
            <button onClick={onClose} className="btn-icon btn-ghost">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ── Identificação ──────────────────────────── */}
            <Section title="Identificação" icon={Building2}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">CNPJ *</label>
                  <input
                    className={`input ${errors.cnpj ? "border-red-500" : ""}`}
                    value={form.cnpj}
                    onChange={(e) => set("cnpj", formatCNPJ(e.target.value))}
                    placeholder="00.000.000/0000-00"
                  />
                  {errors.cnpj && (
                    <p className="text-xs text-red-500 mt-1">{errors.cnpj}</p>
                  )}
                </div>
                <div>
                  <label className="label">Grau de Risco (NR-4)</label>
                  <select
                    className={`select ${errors.grau_risco ? "border-red-500" : ""}`}
                    value={form.grau_risco}
                    onChange={(e) => set("grau_risco", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    <option value="1">1 — Baixo</option>
                    <option value="2">2 — Moderado</option>
                    <option value="3">3 — Alto</option>
                    <option value="4">4 — Muito alto</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Razão Social</label>
                <input
                  className="input"
                  value={form.razao_social}
                  onChange={(e) => set("razao_social", e.target.value)}
                  placeholder="Razão social completa"
                />
              </div>

              <div>
                <label className="label">Nome Fantasia *</label>
                <input
                  className={`input ${errors.nome ? "border-red-500" : ""}`}
                  value={form.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  placeholder="Nome fantasia"
                />
                {errors.nome && (
                  <p className="text-xs text-red-500 mt-1">{errors.nome}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">CNAE</label>
                  <input
                    className="input"
                    value={form.cnae}
                    onChange={(e) => set("cnae", e.target.value)}
                    placeholder="0000-0/00"
                  />
                </div>
                <div>
                  <label className="label">Descrição CNAE</label>
                  <input
                    className="input"
                    value={form.cnae_descricao}
                    onChange={(e) => set("cnae_descricao", e.target.value)}
                    placeholder="Descrição da atividade"
                  />
                </div>
              </div>
            </Section>

            {/* ── Endereço ───────────────────────────────── */}
            <Section title="Endereço" icon={MapPin} defaultOpen={false}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">CEP</label>
                  <div className="relative">
                    <input
                      className="input"
                      value={form.cep}
                      onChange={(e) => set("cep", formatCEP(e.target.value))}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                    />
                    {cepLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="label">Logradouro</label>
                  <input
                    className="input"
                    value={form.logradouro}
                    onChange={(e) => set("logradouro", e.target.value)}
                    placeholder="Rua, Av..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Número</label>
                  <input
                    className="input"
                    value={form.numero}
                    onChange={(e) => set("numero", e.target.value)}
                    placeholder="Nº"
                  />
                </div>
                <div>
                  <label className="label">Complemento</label>
                  <input
                    className="input"
                    value={form.complemento}
                    onChange={(e) => set("complemento", e.target.value)}
                    placeholder="Sala, Andar..."
                  />
                </div>
                <div>
                  <label className="label">Bairro</label>
                  <input
                    className="input"
                    value={form.bairro}
                    onChange={(e) => set("bairro", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cidade</label>
                  <input
                    className="input"
                    value={form.cidade}
                    onChange={(e) => set("cidade", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">UF</label>
                  <select
                    className="select"
                    value={form.uf}
                    onChange={(e) => set("uf", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {UF_OPTIONS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Section>

            {/* ── Contato ────────────────────────────────── */}
            <Section title="Contato" icon={Phone} defaultOpen={false}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Telefone</label>
                  <input
                    className="input"
                    value={form.numero_para_contato}
                    onChange={(e) =>
                      set("numero_para_contato", formatPhone(e.target.value))
                    }
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    className={`input ${errors.email ? "border-red-500" : ""}`}
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="contato@empresa.com.br"
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                  )}
                </div>
              </div>

              <p className="text-xs font-semibold text-slate-500 mt-2">
                Contato do RH (para convocação de periódicos)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Nome RH</label>
                  <input
                    className="input"
                    value={form.contato_rh_nome}
                    onChange={(e) => set("contato_rh_nome", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Telefone RH</label>
                  <input
                    className="input"
                    value={form.contato_rh_telefone}
                    onChange={(e) =>
                      set("contato_rh_telefone", formatPhone(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className="label">Email RH</label>
                  <input
                    className="input"
                    value={form.contato_rh_email}
                    onChange={(e) => set("contato_rh_email", e.target.value)}
                  />
                </div>
              </div>
            </Section>

            {/* ── Fiscal ─────────────────────────────────── */}
            <Section title="Dados Fiscais" icon={FileText} defaultOpen={false}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Inscrição Estadual</label>
                  <input
                    className="input"
                    value={form.inscricao_estadual}
                    onChange={(e) => set("inscricao_estadual", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Inscrição Municipal</label>
                  <input
                    className="input"
                    value={form.inscricao_municipal}
                    onChange={(e) => set("inscricao_municipal", e.target.value)}
                  />
                </div>
              </div>
            </Section>

            {/* ── Observações ────────────────────────────── */}
            <div>
              <label className="label">Observações</label>
              <textarea
                className="input min-h-[80px]"
                value={form.observacoes}
                onChange={(e) => set("observacoes", e.target.value)}
                placeholder="Informações adicionais sobre a empresa..."
              />
            </div>

            {/* ── Actions ────────────────────────────────── */}
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
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isEdit ? (
                  "Salvar"
                ) : (
                  "Cadastrar"
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </>
  );
}
