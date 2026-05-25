// src/features/financeiro/components/PagamentoForm.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Receipt } from "lucide-react";
import { motion } from "framer-motion";

import { Pagamento } from "@/types";
import { pagamentosAPI } from "@/services/api";
import {
  usePacientesAutocomplete,
  useEmpresasAutocomplete,
  useConveniosAutocomplete,
} from "../hooks/useAutocomplete";
import {
  PacienteSelector,
  EmpresaSelector,
  ConvenioSelector,
  EntityOption,
} from "./EntitySearchSelector";

type PagamentoOrigem =
  | "PACIENTE"
  | "EMPRESA"
  | "CONVÊNIO"
  | "OUTROS"
  | "EXAMES";
type PagamentoTipo =
  | "PIX"
  | "DINHEIRO"
  | "DÉBITO"
  | "CRÉDITO"
  | "TRANSFERÊNCIA BANCÁRIA";
type TipoPessoaPix = "PF" | "PJ" | "";

interface PagamentoFormData {
  tipo: PagamentoTipo;
  valor: string;
  possui_desconto: boolean;
  valor_desconto: string;
  data: string;
  origem: PagamentoOrigem;
  descricao: string;
  qtd_parcelas_credito: number;

  // PIX
  tipo_pessoa_pix: TipoPessoaPix;
  conta_destinada_pix: TipoPessoaPix;

  // Nota fiscal
  vinculado_nota_fiscal: boolean;
  numero_nota_fiscal: string;

  nome_do_paciente: string;
  nome_empresa: string;
  nome_convenio: string;
  avulso: boolean;
}

interface SelectedEntities {
  paciente: EntityOption | null;
  empresa: EntityOption | null;
  convenio: EntityOption | null;
}

interface PagamentoFormProps {
  mode: "create" | "edit";
  editingPagamento?: Pagamento | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const todayISO = () => new Date().toISOString().split("T")[0];

const INITIAL_FORM: PagamentoFormData = {
  tipo: "PIX",
  valor: "",
  possui_desconto: false,
  valor_desconto: "",
  data: todayISO(),
  origem: "PACIENTE",
  descricao: "",
  qtd_parcelas_credito: 1,

  tipo_pessoa_pix: "",
  conta_destinada_pix: "",

  vinculado_nota_fiscal: false,
  numero_nota_fiscal: "",

  nome_do_paciente: "",
  nome_empresa: "",
  nome_convenio: "",
  avulso: false,
};

function onlyDigits(v: string): string {
  return (v || "").replace(/\D/g, "");
}

function safeNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function PagamentoForm({
  mode,
  editingPagamento,
  onSuccess,
  onCancel,
}: PagamentoFormProps) {
  const [formData, setFormData] = useState<PagamentoFormData>(INITIAL_FORM);
  const [selected, setSelected] = useState<SelectedEntities>({
    paciente: null,
    empresa: null,
    convenio: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks de autocomplete
  const pacientesAC = usePacientesAutocomplete({ minChars: 2, limit: 30 });
  const empresasAC = useEmpresasAutocomplete({ minChars: 2, limit: 30 });
  const conveniosAC = useConveniosAutocomplete({ minChars: 2, limit: 30 });

  // Converter resultados do autocomplete para EntityOption
  const pacienteOptions: EntityOption[] = useMemo(
    () =>
      pacientesAC.items.map((p) => ({
        id: p.cpf_raw,
        label: p.nome,
        sublabel: `CPF: ${p.cpf}`,
        meta: p.empresa_nome
          ? `Empresa: ${p.empresa_nome}`
          : p.convenio_nome
            ? `Convênio: ${p.convenio_nome}`
            : undefined,
      })),
    [pacientesAC.items],
  );

  const empresaOptions: EntityOption[] = useMemo(
    () =>
      empresasAC.items.map((e) => ({
        id: e.id,
        label: e.nome,
        sublabel: `CNPJ: ${e.cnpj}`,
        meta:
          e.total_pacientes > 0 ? `${e.total_pacientes} pacientes` : undefined,
      })),
    [empresasAC.items],
  );

  const convenioOptions: EntityOption[] = useMemo(
    () =>
      conveniosAC.items.map((c) => ({
        id: c.id,
        label: c.nome,
        sublabel: `CNPJ: ${c.cnpj}`,
        meta: c.emite_guia ? "Emite guia" : undefined,
      })),
    [conveniosAC.items],
  );

  // Preencher form quando editar
  useEffect(() => {
    if (mode === "edit" && editingPagamento) {
      const p = editingPagamento as any;

      setFormData({
        tipo: (p.tipo as PagamentoTipo) || "PIX",
        valor: p.valor != null ? String(p.valor) : "",
        possui_desconto: !!p.possui_desconto,
        valor_desconto:
          p.valor_desconto != null ? String(p.valor_desconto) : "",
        data: p.data || todayISO(),
        origem: (p.origem as PagamentoOrigem) || "OUTROS",
        descricao: p.descricao ?? "",
        qtd_parcelas_credito: p.qtd_parcelas_credito ?? 1,

        tipo_pessoa_pix: (p.tipo_pessoa_pix as TipoPessoaPix) || "",
        conta_destinada_pix: (p.conta_destinada_pix as TipoPessoaPix) || "",

        vinculado_nota_fiscal: !!p.vinculado_nota_fiscal,
        numero_nota_fiscal: p.numero_nota_fiscal ?? "",

        nome_do_paciente: p.nome_do_paciente ?? "",
        nome_empresa: p.nome_empresa ?? "",
        nome_convenio: p.nome_convenio ?? "",
        avulso: !(p.cpf || p.empresa_id || p.convenio_id),
      });

      const cpfDigits = p.cpf ? onlyDigits(String(p.cpf)) : "";

      setSelected({
        paciente: cpfDigits
          ? {
              id: Number(cpfDigits),
              label: p.nome_do_paciente || "Paciente",
              sublabel: `CPF: ${cpfDigits}`,
            }
          : null,
        empresa: p.empresa_id
          ? {
              id: Number(p.empresa_id),
              label: p.nome_empresa || "Empresa",
              sublabel: p.cnpj_empresa ? `CNPJ: ${p.cnpj_empresa}` : undefined,
            }
          : null,
        convenio: p.convenio_id
          ? {
              id: Number(p.convenio_id),
              label: p.nome_convenio || "Convênio",
              sublabel: p.cnpj_convenio
                ? `CNPJ: ${p.cnpj_convenio}`
                : undefined,
            }
          : null,
      });
    }

    if (mode === "create") {
      setFormData(INITIAL_FORM);
      setSelected({ paciente: null, empresa: null, convenio: null });
      setError(null);
    }
  }, [mode, editingPagamento]);

  const updateForm = useCallback(
    <K extends keyof PagamentoFormData>(
      key: K,
      value: PagamentoFormData[K],
    ) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setError(null);
    },
    [],
  );

  const handleOrigemChange = useCallback(
    (newOrigem: PagamentoOrigem) => {
      updateForm("origem", newOrigem);
      setSelected({ paciente: null, empresa: null, convenio: null });
      pacientesAC.clear();
      empresasAC.clear();
      conveniosAC.clear();

      setFormData((prev) => ({
        ...prev,
        origem: newOrigem,
        avulso: newOrigem === "OUTROS" || newOrigem === "EXAMES",
      }));
    },
    [updateForm, pacientesAC, empresasAC, conveniosAC],
  );

  const handleSelectPaciente = useCallback((option: EntityOption) => {
    setSelected((prev) => ({ ...prev, paciente: option }));
    setFormData((prev) => ({
      ...prev,
      nome_do_paciente: option.label,
    }));
  }, []);

  const handleSelectEmpresa = useCallback((option: EntityOption) => {
    setSelected((prev) => ({ ...prev, empresa: option }));
    setFormData((prev) => ({
      ...prev,
      nome_empresa: option.label,
    }));
  }, []);

  const handleSelectConvenio = useCallback((option: EntityOption) => {
    setSelected((prev) => ({ ...prev, convenio: option }));
    setFormData((prev) => ({
      ...prev,
      nome_convenio: option.label,
    }));
  }, []);

  const handleClearEntity = useCallback(
    (type: "paciente" | "empresa" | "convenio") => {
      setSelected((prev) => ({ ...prev, [type]: null }));

      if (type === "paciente") {
        pacientesAC.clear();
        setFormData((prev) => ({ ...prev, nome_do_paciente: "" }));
      } else if (type === "empresa") {
        empresasAC.clear();
        setFormData((prev) => ({ ...prev, nome_empresa: "" }));
      } else {
        conveniosAC.clear();
        setFormData((prev) => ({ ...prev, nome_convenio: "" }));
      }
    },
    [pacientesAC, empresasAC, conveniosAC],
  );

  const validate = useCallback((): string | null => {
    const valor = safeNumber(formData.valor);
    if (!valor || valor <= 0) return "Informe um valor maior que 0.";
    if (!formData.data) return "Informe a data do pagamento.";

    if (formData.possui_desconto) {
      const desc = safeNumber(formData.valor_desconto) ?? 0;
      if (desc < 0) return "Desconto inválido.";
      if (valor && desc > valor)
        return "O desconto não pode ser maior que o valor.";
    }

    if (formData.tipo === "CRÉDITO") {
      const q = formData.qtd_parcelas_credito;
      if (!Number.isFinite(q) || q < 1)
        return "Quantidade de parcelas inválida.";
    }

    if (formData.tipo === "PIX") {
      if (!formData.tipo_pessoa_pix) {
        return "Informe se o pagador PIX é Pessoa Física (PF) ou Pessoa Jurídica (PJ).";
      }
      if (!formData.conta_destinada_pix) {
        return "Informe a conta destinada do PIX (PF ou PJ).";
      }
    }

    // Validação nota fiscal
    if (formData.vinculado_nota_fiscal && !formData.numero_nota_fiscal.trim()) {
      return "Informe o número da nota fiscal.";
    }

    if (!formData.avulso) {
      if (formData.origem === "PACIENTE" && !selected.paciente) {
        return 'Selecione um paciente (ou marque "Pagamento avulso").';
      }
      if (formData.origem === "EMPRESA" && !selected.empresa) {
        return 'Selecione uma empresa (ou marque "Pagamento avulso").';
      }
      if (formData.origem === "CONVÊNIO" && !selected.convenio) {
        return 'Selecione um convênio (ou marque "Pagamento avulso").';
      }
    }

    return null;
  }, [formData, selected]);

  const buildPayload = useCallback(() => {
    const payload: Record<string, any> = {
      tipo: formData.tipo,
      origem: formData.origem,
      data: formData.data,
      descricao: formData.descricao.trim() || null,
      valor: safeNumber(formData.valor) ?? 0,
      possui_desconto: formData.possui_desconto,
      valor_desconto: formData.possui_desconto
        ? (safeNumber(formData.valor_desconto) ?? 0)
        : null,
      qtd_parcelas_credito:
        formData.tipo === "CRÉDITO" ? formData.qtd_parcelas_credito : null,

      // PIX
      tipo_pessoa_pix:
        formData.tipo === "PIX" && formData.tipo_pessoa_pix
          ? formData.tipo_pessoa_pix
          : null,
      conta_destinada_pix:
        formData.tipo === "PIX" && formData.conta_destinada_pix
          ? formData.conta_destinada_pix
          : null,

      // Nota fiscal
      vinculado_nota_fiscal: formData.vinculado_nota_fiscal,
      numero_nota_fiscal: formData.vinculado_nota_fiscal
        ? formData.numero_nota_fiscal.trim() || null
        : null,

      nome_do_paciente: formData.nome_do_paciente.trim() || null,
      nome_empresa: formData.nome_empresa.trim() || null,
      nome_convenio: formData.nome_convenio.trim() || null,
      cpf: null,
      empresa_id: null,
      convenio_id: null,
    };

    if (!formData.avulso) {
      if (formData.origem === "PACIENTE" && selected.paciente) {
        payload.cpf = selected.paciente.id;
      } else if (formData.origem === "EMPRESA" && selected.empresa) {
        payload.empresa_id = selected.empresa.id;
      } else if (formData.origem === "CONVÊNIO" && selected.convenio) {
        payload.convenio_id = selected.convenio.id;
      }
    }

    return payload;
  }, [formData, selected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = buildPayload();

      if (mode === "create") {
        await pagamentosAPI.create(payload);
      } else if (editingPagamento?.id) {
        await pagamentosAPI.update(editingPagamento.id, payload);
      }

      onSuccess();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        (mode === "create"
          ? "Erro ao criar pagamento"
          : "Erro ao atualizar pagamento");
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const origemUpper = formData.origem.toUpperCase();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Erro */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-danger-light border border-danger/20 text-danger"
        >
          {error}
        </motion.div>
      )}

      {/* Seção: Dados do Pagamento */}
      <section>
        <h4 className="text-lg font-semibold text-secondary-800 mb-4 pb-2 border-b border-secondary-200">
          Dados do Pagamento
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Tipo */}
          <div>
            <label className="label">Tipo de pagamento *</label>
            <select
              value={formData.tipo}
              onChange={(e) => {
                const newTipo = e.target.value as PagamentoTipo;
                updateForm("tipo", newTipo);

                // limpa campos PIX quando sair de PIX
                if (newTipo !== "PIX") {
                  setFormData((prev) => ({
                    ...prev,
                    tipo_pessoa_pix: "",
                    conta_destinada_pix: "",
                  }));
                }
              }}
              className="select text-base py-3"
              required
            >
              <option value="PIX">PIX</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="DÉBITO">Débito</option>
              <option value="CRÉDITO">Crédito</option>
              <option value="TRANSFERÊNCIA BANCÁRIA">Transferência</option>
            </select>
          </div>

          {/* Origem */}
          <div>
            <label className="label">Origem *</label>
            <select
              value={formData.origem}
              onChange={(e) =>
                handleOrigemChange(e.target.value as PagamentoOrigem)
              }
              className="select text-base py-3"
              required
            >
              <option value="PACIENTE">Paciente</option>
              <option value="EMPRESA">Empresa</option>
              <option value="CONVÊNIO">Convênio</option>
              <option value="OUTROS">Outros</option>
              <option value="EXAMES">Exames</option>
            </select>
          </div>

          {/* Data */}
          <div>
            <label className="label">Data *</label>
            <input
              type="date"
              value={formData.data}
              onChange={(e) => updateForm("data", e.target.value)}
              className="input text-base py-3"
              required
            />
          </div>

          {/* Valor */}
          <div>
            <label className="label">Valor (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.valor}
              onChange={(e) => updateForm("valor", e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className="input text-base py-3 text-lg font-medium"
              placeholder="0,00"
              required
            />
          </div>

          {/* Parcelas (só crédito) */}
          {formData.tipo === "CRÉDITO" && (
            <div>
              <label className="label">Parcelas</label>
              <input
                type="number"
                min={1}
                max={24}
                value={formData.qtd_parcelas_credito}
                onChange={(e) =>
                  updateForm(
                    "qtd_parcelas_credito",
                    Math.max(1, Number(e.target.value || 1)),
                  )
                }
                onWheel={(e) => e.currentTarget.blur()}
                className="input text-base py-3"
              />
            </div>
          )}

          {/* Desconto */}
          <div
            className={
              formData.tipo === "CRÉDITO" ? "" : "sm:col-span-2 lg:col-span-1"
            }
          >
            <label className="label">Desconto</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.possui_desconto}
                  onChange={(e) =>
                    updateForm("possui_desconto", e.target.checked)
                  }
                  className="w-5 h-5 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-secondary-700">Aplicar</span>
              </label>
              {formData.possui_desconto && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_desconto}
                  onChange={(e) => updateForm("valor_desconto", e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="input text-base py-2 flex-1"
                  placeholder="Valor"
                />
              )}
            </div>
          </div>

          {/* PIX: Pagador + Conta destino */}
          {formData.tipo === "PIX" && (
            <div className="sm:col-span-2 lg:col-span-3 space-y-4">
              {/* Pagador */}
              <div>
                <label className="label">Pagador PIX *</label>
                <div className="flex flex-wrap gap-4 mt-2">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-secondary-200 hover:border-primary-300 transition-colors has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
                    <input
                      type="radio"
                      name="tipo_pessoa_pix"
                      value="PF"
                      checked={formData.tipo_pessoa_pix === "PF"}
                      onChange={() => updateForm("tipo_pessoa_pix", "PF")}
                      className="w-5 h-5 border-secondary-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-base text-secondary-800 font-medium">
                      Pessoa Física (PF)
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-secondary-200 hover:border-primary-300 transition-colors has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
                    <input
                      type="radio"
                      name="tipo_pessoa_pix"
                      value="PJ"
                      checked={formData.tipo_pessoa_pix === "PJ"}
                      onChange={() => updateForm("tipo_pessoa_pix", "PJ")}
                      className="w-5 h-5 border-secondary-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-base text-secondary-800 font-medium">
                      Pessoa Jurídica (PJ)
                    </span>
                  </label>
                </div>
              </div>

              {/* Conta destino */}
              <div>
                <label className="label">Conta destinada (PIX) *</label>
                <div className="flex flex-wrap gap-4 mt-2">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-secondary-200 hover:border-primary-300 transition-colors has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
                    <input
                      type="radio"
                      name="conta_destinada_pix"
                      value="PF"
                      checked={formData.conta_destinada_pix === "PF"}
                      onChange={() => updateForm("conta_destinada_pix", "PF")}
                      className="w-5 h-5 border-secondary-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-base text-secondary-800 font-medium">
                      PF (Pessoa Física)
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-secondary-200 hover:border-primary-300 transition-colors has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
                    <input
                      type="radio"
                      name="conta_destinada_pix"
                      value="PJ"
                      checked={formData.conta_destinada_pix === "PJ"}
                      onChange={() => updateForm("conta_destinada_pix", "PJ")}
                      className="w-5 h-5 border-secondary-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-base text-secondary-800 font-medium">
                      PJ (Pessoa Jurídica)
                    </span>
                  </label>
                </div>

                <p className="text-xs text-secondary-500 mt-2">
                  Obrigatório apenas para pagamentos PIX.
                </p>
              </div>
            </div>
          )}

          {/* Descrição */}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label">Descrição</label>
            <input
              value={formData.descricao}
              onChange={(e) => updateForm("descricao", e.target.value)}
              className="input text-base py-3"
              placeholder="Ex: consulta ocupacional, exame, taxa, etc."
            />
          </div>
        </div>
      </section>

      {/* Seção: Nota Fiscal */}
      <section>
        <h4 className="text-lg font-semibold text-secondary-800 mb-4 pb-2 border-b border-secondary-200 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary-600" />
          Nota Fiscal
        </h4>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 border-secondary-200 hover:border-primary-300 transition-colors has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
            <input
              type="checkbox"
              checked={formData.vinculado_nota_fiscal}
              onChange={(e) => {
                updateForm("vinculado_nota_fiscal", e.target.checked);
                if (!e.target.checked) {
                  updateForm("numero_nota_fiscal", "");
                }
              }}
              className="w-5 h-5 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <span className="text-base text-secondary-800 font-medium">
                Vincular a nota fiscal
              </span>
              <p className="text-sm text-secondary-500 mt-0.5">
                Marque se este pagamento está vinculado a uma nota fiscal
                emitida
              </p>
            </div>
          </label>

          {formData.vinculado_nota_fiscal && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <label className="label">Número da nota fiscal *</label>
              <input
                type="text"
                value={formData.numero_nota_fiscal}
                onChange={(e) =>
                  updateForm("numero_nota_fiscal", e.target.value)
                }
                className="input text-base py-3"
                placeholder="Ex: 000123456"
                required={formData.vinculado_nota_fiscal}
              />
              <p className="text-xs text-secondary-500 mt-1">
                Informe o número da nota fiscal para controle interno.
              </p>
            </motion.div>
          )}
        </div>
      </section>

      {/* Seção: Identificação */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-secondary-200">
          <div>
            <h4 className="text-lg font-semibold text-secondary-800">
              Identificação
            </h4>
            <p className="text-sm text-secondary-500 mt-1">
              Selecione o{" "}
              {origemUpper === "PACIENTE"
                ? "paciente"
                : origemUpper === "EMPRESA"
                  ? "empresa"
                  : origemUpper === "CONVÊNIO"
                    ? "convênio"
                    : "responsável"}{" "}
              pelo pagamento
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-secondary-100 hover:bg-secondary-200 transition-colors">
            <input
              type="checkbox"
              checked={formData.avulso}
              onChange={(e) => {
                const isAvulso = e.target.checked;
                updateForm("avulso", isAvulso);
                if (isAvulso) {
                  setSelected({
                    paciente: null,
                    empresa: null,
                    convenio: null,
                  });
                }
              }}
              className="w-5 h-5 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-secondary-700">
              Pagamento avulso (sem vínculo)
            </span>
          </label>
        </div>

        {/* Seletores baseados na origem */}
        {!formData.avulso && (
          <div className="grid grid-cols-1 gap-6">
            {/* Paciente */}
            {origemUpper === "PACIENTE" && (
              <PacienteSelector
                query={pacientesAC.query}
                onQueryChange={pacientesAC.setQuery}
                loading={pacientesAC.loading}
                options={pacienteOptions}
                selected={selected.paciente}
                onSelect={handleSelectPaciente}
                onClear={() => handleClearEntity("paciente")}
              />
            )}

            {/* Empresa */}
            {origemUpper === "EMPRESA" && (
              <EmpresaSelector
                query={empresasAC.query}
                onQueryChange={empresasAC.setQuery}
                loading={empresasAC.loading}
                options={empresaOptions}
                selected={selected.empresa}
                onSelect={handleSelectEmpresa}
                onClear={() => handleClearEntity("empresa")}
              />
            )}

            {/* Convênio */}
            {origemUpper === "CONVÊNIO" && (
              <ConvenioSelector
                query={conveniosAC.query}
                onQueryChange={conveniosAC.setQuery}
                loading={conveniosAC.loading}
                options={convenioOptions}
                selected={selected.convenio}
                onSelect={handleSelectConvenio}
                onClear={() => handleClearEntity("convenio")}
              />
            )}

            {/* Outros/Exames */}
            {(origemUpper === "OUTROS" || origemUpper === "EXAMES") && (
              <div className="p-6 rounded-xl bg-secondary-50 border-2 border-dashed border-secondary-300 text-center">
                <p className="text-secondary-600">
                  Para origem "{formData.origem}", use o campo manual abaixo ou
                  marque "Pagamento avulso".
                </p>
              </div>
            )}
          </div>
        )}

        {/* Campos manuais quando avulso */}
        {formData.avulso && (
          <div className="p-6 rounded-xl bg-amber-50 border-2 border-dashed border-amber-200">
            <label className="label text-amber-800">
              Nome (identificação manual)
            </label>
            <input
              value={
                origemUpper === "PACIENTE"
                  ? formData.nome_do_paciente
                  : origemUpper === "EMPRESA"
                    ? formData.nome_empresa
                    : origemUpper === "CONVÊNIO"
                      ? formData.nome_convenio
                      : formData.nome_do_paciente
              }
              onChange={(e) => {
                if (origemUpper === "PACIENTE")
                  updateForm("nome_do_paciente", e.target.value);
                else if (origemUpper === "EMPRESA")
                  updateForm("nome_empresa", e.target.value);
                else if (origemUpper === "CONVÊNIO")
                  updateForm("nome_convenio", e.target.value);
                else updateForm("nome_do_paciente", e.target.value);
              }}
              className="input text-base py-3 bg-white"
              placeholder="Ex: Fulano da Silva / Empresa X / Convênio Y"
            />
            <p className="text-sm text-amber-700 mt-2">
              Use este campo para identificar o pagamento quando não há cadastro
              no sistema.
            </p>
          </div>
        )}

        {/* Dica */}
        {!formData.avulso &&
          origemUpper !== "OUTROS" &&
          origemUpper !== "EXAMES" && (
            <p className="text-sm text-secondary-500 mt-4 p-3 bg-secondary-50 rounded-lg">
              <strong>Dica:</strong> Se não encontrar na busca, marque
              "Pagamento avulso" e preencha manualmente.
            </p>
          )}
      </section>

      {/* Botões */}
      <div className="flex gap-4 pt-4 border-t border-secondary-200">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1 py-3 text-base"
          disabled={saving}
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary flex-1 py-3 text-base"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : mode === "create" ? (
            "Cadastrar Pagamento"
          ) : (
            "Salvar Alterações"
          )}
        </button>
      </div>
    </form>
  );
}
