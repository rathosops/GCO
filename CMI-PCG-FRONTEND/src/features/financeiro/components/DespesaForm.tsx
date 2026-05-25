// src/features/financeiro/components/DespesaForm.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Info,
  CalendarDays,
  DollarSign,
  Building2,
  FileText,
  CreditCard,
  Tag,
  Repeat,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { despesasAPI } from '@/services/despesas.api';
import type {
  Despesa,
  DespesaCategoria,
  DespesaTipoCusto,
  DespesaCentroCusto,
  DespesaRecorrencia,
  DespesaFormaPagamento,
  DespesaTipoDocumento,
} from '@/types/despesas.types';
import {
  CATEGORIA_LABELS,
  CENTRO_CUSTO_LABELS,
  RECORRENCIA_LABELS,
  FORMA_PAGAMENTO_LABELS,
} from '@/types/despesas.types';

interface DespesaFormData {
  descricao: string;
  observacoes: string;
  categoria: DespesaCategoria;
  tipo_custo: DespesaTipoCusto;
  centro_custo: DespesaCentroCusto | '';
  valor: string;
  valor_desconto: string;
  valor_juros_multa: string;
  data_competencia: string;
  data_vencimento: string;
  data_pagamento: string;
  status: string;
  recorrencia: DespesaRecorrencia;
  forma_pagamento: DespesaFormaPagamento | '';
  conta_saida: string;
  fornecedor_nome: string;
  fornecedor_cnpj_cpf: string;
  numero_documento: string;
  tipo_documento: DespesaTipoDocumento | '';
}

interface DespesaFormProps {
  mode: 'create' | 'edit';
  editingDespesa?: Despesa | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const todayISO = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const INITIAL_FORM: DespesaFormData = {
  descricao: '',
  observacoes: '',
  categoria: 'OUTROS',
  tipo_custo: 'VARIAVEL',
  centro_custo: '',
  valor: '',
  valor_desconto: '',
  valor_juros_multa: '',
  data_competencia: firstOfMonth(),
  data_vencimento: todayISO(),
  data_pagamento: '',
  status: '',
  recorrencia: 'UNICA',
  forma_pagamento: '',
  conta_saida: '',
  fornecedor_nome: '',
  fornecedor_cnpj_cpf: '',
  numero_documento: '',
  tipo_documento: '',
};

function safeNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Helper: inline hint abaixo do campo */
function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-xs text-secondary-400 leading-relaxed flex items-start gap-1">
      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export default function DespesaForm({
  mode,
  editingDespesa,
  onSuccess,
  onCancel,
}: DespesaFormProps) {
  const [formData, setFormData] = useState<DespesaFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && editingDespesa) {
      const d = editingDespesa;
      setFormData({
        descricao: d.descricao || '',
        observacoes: d.observacoes || '',
        categoria: d.categoria || 'OUTROS',
        tipo_custo: d.tipo_custo || 'VARIAVEL',
        centro_custo: (d.centro_custo as DespesaCentroCusto) || '',
        valor: d.valor != null ? String(d.valor) : '',
        valor_desconto: d.valor_desconto != null ? String(d.valor_desconto) : '',
        valor_juros_multa: d.valor_juros_multa != null ? String(d.valor_juros_multa) : '',
        data_competencia: d.data_competencia || firstOfMonth(),
        data_vencimento: d.data_vencimento || todayISO(),
        data_pagamento: d.data_pagamento || '',
        status: d.status || '',
        recorrencia: d.recorrencia || 'UNICA',
        forma_pagamento: (d.forma_pagamento as DespesaFormaPagamento) || '',
        conta_saida: d.conta_saida || '',
        fornecedor_nome: d.fornecedor_nome || '',
        fornecedor_cnpj_cpf: d.fornecedor_cnpj_cpf || '',
        numero_documento: d.numero_documento || '',
        tipo_documento: (d.tipo_documento as DespesaTipoDocumento) || '',
      });
    }
    if (mode === 'create') {
      setFormData(INITIAL_FORM);
      setError(null);
    }
  }, [mode, editingDespesa]);

  const updateForm = useCallback(
    <K extends keyof DespesaFormData>(key: K, value: DespesaFormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setError(null);
    },
    []
  );

  const validate = useCallback((): string | null => {
    if (!formData.descricao.trim()) return 'Informe a descrição da despesa.';
    const valor = safeNumber(formData.valor);
    if (!valor || valor <= 0) return 'Informe um valor maior que 0.';
    if (!formData.data_vencimento) return 'Informe a data de vencimento.';
    if (!formData.data_competencia) return 'Informe a data de competência.';
    return null;
  }, [formData]);

  const buildPayload = useCallback(() => {
    const payload: Record<string, unknown> = {
      descricao: formData.descricao.trim(),
      observacoes: formData.observacoes.trim() || null,
      categoria: formData.categoria,
      tipo_custo: formData.tipo_custo,
      centro_custo: formData.centro_custo || null,
      valor: safeNumber(formData.valor),
      valor_desconto: safeNumber(formData.valor_desconto),
      valor_juros_multa: safeNumber(formData.valor_juros_multa),
      data_competencia: formData.data_competencia,
      data_vencimento: formData.data_vencimento,
      data_pagamento: formData.data_pagamento || null,
      recorrencia: formData.recorrencia,
      forma_pagamento: formData.forma_pagamento || null,
      conta_saida: formData.conta_saida.trim() || null,
      fornecedor_nome: formData.fornecedor_nome.trim() || null,
      fornecedor_cnpj_cpf: formData.fornecedor_cnpj_cpf.replace(/\D/g, '') || null,
      numero_documento: formData.numero_documento.trim() || null,
      tipo_documento: formData.tipo_documento || null,
    };
    if (formData.status) payload.status = formData.status;
    return payload;
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (mode === 'create') {
        await despesasAPI.create(payload as Partial<Despesa>);
      } else if (editingDespesa?.id) {
        await despesasAPI.update(editingDespesa.id, payload as Partial<Despesa>);
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao salvar despesa');
    } finally {
      setSaving(false);
    }
  };

  // Cálculo do valor líquido em tempo real
  const valorBruto = safeNumber(formData.valor) ?? 0;
  const valorDesconto = safeNumber(formData.valor_desconto) ?? 0;
  const valorJuros = safeNumber(formData.valor_juros_multa) ?? 0;
  const valorLiquido = valorBruto - valorDesconto + valorJuros;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Erro global */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-danger-light border border-danger/20 text-danger flex items-start gap-3"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Erro ao salvar despesa</p>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           SEÇÃO 1: O que é essa despesa?
         ═══════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Tag className="h-5 w-5 text-primary-600" />
          <h4 className="text-base font-bold text-secondary-900">Identificação da despesa</h4>
        </div>
        <p className="text-sm text-secondary-500 mb-5">
          Descreva o gasto, classifique a categoria e defina se é custo fixo ou variável.
        </p>

        <div className="grid grid-cols-1 gap-5">
          {/* Descrição — full width */}
          <div>
            <label className="label">
              Descrição <span className="text-danger">*</span>
            </label>
            <input
              value={formData.descricao}
              onChange={(e) => updateForm('descricao', e.target.value)}
              className="input"
              placeholder="Ex: Aluguel da sala — janeiro/2026, Compra de luvas descartáveis, Conta de luz..."
              required
            />
            <FieldHint>
              Descreva de forma clara o que é essa despesa. Será usado nas buscas e nos relatórios.
            </FieldHint>
          </div>

          {/* Linha 2: Categoria + Tipo custo + Centro custo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">
                Categoria <span className="text-danger">*</span>
              </label>
              <select
                value={formData.categoria}
                onChange={(e) => updateForm('categoria', e.target.value as DespesaCategoria)}
                className="select"
                required
              >
                {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <FieldHint>
                Agrupa despesas semelhantes para análise. Ex: "Pessoal" = salários; "Utilidades" = água, luz, internet.
              </FieldHint>
            </div>

            <div>
              <label className="label">
                Tipo de custo <span className="text-danger">*</span>
              </label>
              <select
                value={formData.tipo_custo}
                onChange={(e) => updateForm('tipo_custo', e.target.value as DespesaTipoCusto)}
                className="select"
                required
              >
                <option value="FIXO">Fixo</option>
                <option value="VARIAVEL">Variável</option>
              </select>
              <FieldHint>
                <strong>Fixo:</strong> valor constante todo mês (aluguel, salários).{' '}
                <strong>Variável:</strong> oscila conforme a demanda (insumos, comissões).
              </FieldHint>
            </div>

            <div>
              <label className="label">Centro de custo</label>
              <select
                value={formData.centro_custo}
                onChange={(e) => updateForm('centro_custo', e.target.value as DespesaCentroCusto | '')}
                className="select"
              >
                <option value="">— Nenhum —</option>
                {Object.entries(CENTRO_CUSTO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <FieldHint>
                Opcional. Identifica qual setor da clínica gerou o gasto (Clínico, Farmácia, TI, etc).
              </FieldHint>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
           SEÇÃO 2: Quanto custa e quando vence?
         ═══════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="h-5 w-5 text-primary-600" />
          <h4 className="text-base font-bold text-secondary-900">Valores e datas</h4>
        </div>
        <p className="text-sm text-secondary-500 mb-5">
          Informe o valor da despesa, as datas de competência e vencimento, e se há desconto ou acréscimos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Valor */}
          <div>
            <label className="label">
              Valor (R$) <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary-400 font-medium">R$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.valor}
                onChange={(e) => updateForm('valor', e.target.value)}
                className="input pl-10 text-lg font-semibold"
                placeholder="0,00"
                required
              />
            </div>
            <FieldHint>Valor bruto original da despesa (sem considerar descontos ou juros).</FieldHint>
          </div>

          {/* Desconto */}
          <div>
            <label className="label">Desconto (R$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-green-500 font-medium">-</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_desconto}
                onChange={(e) => updateForm('valor_desconto', e.target.value)}
                className="input pl-8"
                placeholder="0,00"
              />
            </div>
            <FieldHint>Desconto obtido por pagamento antecipado, negociação, etc.</FieldHint>
          </div>

          {/* Juros/Multa */}
          <div>
            <label className="label">Juros / Multa (R$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-red-500 font-medium">+</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_juros_multa}
                onChange={(e) => updateForm('valor_juros_multa', e.target.value)}
                className="input pl-8"
                placeholder="0,00"
              />
            </div>
            <FieldHint>Juros ou multa por atraso no pagamento.</FieldHint>
          </div>

          {/* Valor líquido calculado */}
          <div>
            <label className="label">Valor líquido</label>
            <div className="input bg-secondary-50 text-lg font-bold text-primary-700 flex items-center cursor-default">
              {valorBruto > 0
                ? valorLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : '—'}
            </div>
            <FieldHint>Calculado: valor − desconto + juros. É o que será efetivamente pago.</FieldHint>
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          <div>
            <label className="label flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-secondary-400" />
              Competência <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              value={formData.data_competencia}
              onChange={(e) => updateForm('data_competencia', e.target.value)}
              className="input"
              required
            />
            <FieldHint>
              Mês/ano a que a despesa se refere (regime de competência). Ex: aluguel de março → competência março, mesmo pago em fevereiro.
            </FieldHint>
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-secondary-400" />
              Vencimento <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              value={formData.data_vencimento}
              onChange={(e) => updateForm('data_vencimento', e.target.value)}
              className="input"
              required
            />
            <FieldHint>
              Data limite para pagamento. Despesas não pagas após essa data ficam "Atrasadas".
            </FieldHint>
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <Repeat className="h-4 w-4 text-secondary-400" />
              Recorrência
            </label>
            <select
              value={formData.recorrencia}
              onChange={(e) => updateForm('recorrencia', e.target.value as DespesaRecorrencia)}
              className="select"
            >
              {Object.entries(RECORRENCIA_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <FieldHint>
              Se "Mensal", "Trimestral" etc., indica que essa despesa se repete. Deixe "Única" para gastos pontuais.
            </FieldHint>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
           SEÇÃO 3: Como será pago?
         ═══════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-5 w-5 text-primary-600" />
          <h4 className="text-base font-bold text-secondary-900">Forma de pagamento</h4>
        </div>
        <p className="text-sm text-secondary-500 mb-5">
          Opcional. Preencha se já souber como/quando será pago. Você também pode informar depois ao clicar "Pagar".
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Forma de pagamento</label>
            <select
              value={formData.forma_pagamento}
              onChange={(e) => updateForm('forma_pagamento', e.target.value as DespesaFormaPagamento | '')}
              className="select"
            >
              <option value="">— Não definida —</option>
              {Object.entries(FORMA_PAGAMENTO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <FieldHint>Como a despesa será/foi paga: PIX, Boleto, Débito Automático, etc.</FieldHint>
          </div>

          <div>
            <label className="label">Conta de saída</label>
            <input
              value={formData.conta_saida}
              onChange={(e) => updateForm('conta_saida', e.target.value)}
              className="input"
              placeholder="Ex: Bradesco PJ, Caixa PJ, Nubank..."
            />
            <FieldHint>Conta bancária de onde sairá o pagamento. Útil para conciliação.</FieldHint>
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-secondary-400" />
              Data de pagamento
            </label>
            <input
              type="date"
              value={formData.data_pagamento}
              onChange={(e) => updateForm('data_pagamento', e.target.value)}
              className="input"
            />
            <FieldHint>Deixe em branco se ainda não foi pago. Será preenchido ao clicar "Pagar".</FieldHint>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
           SEÇÃO 4: Quem é o fornecedor / documento?
         ═══════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-5 w-5 text-primary-600" />
          <h4 className="text-base font-bold text-secondary-900">Fornecedor e documento fiscal</h4>
        </div>
        <p className="text-sm text-secondary-500 mb-5">
          Opcional. Registre o prestador/fornecedor e o documento vinculado (NF, boleto, recibo) para rastreabilidade.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nome do fornecedor / prestador</label>
            <input
              value={formData.fornecedor_nome}
              onChange={(e) => updateForm('fornecedor_nome', e.target.value)}
              className="input"
              placeholder="Ex: Distribuidora ABC, Imobiliária XYZ, Dr. João..."
            />
            <FieldHint>
              Quem emitiu a cobrança. Usado nos relatórios de "Top Fornecedores".
            </FieldHint>
          </div>

          <div>
            <label className="label">CNPJ ou CPF do fornecedor</label>
            <input
              value={formData.fornecedor_cnpj_cpf}
              onChange={(e) => updateForm('fornecedor_cnpj_cpf', e.target.value)}
              className="input"
              placeholder="Apenas números — ex: 12345678000199"
            />
            <FieldHint>
              Opcional. Informe apenas os dígitos (sem pontos ou traços).
            </FieldHint>
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-secondary-400" />
              Tipo de documento
            </label>
            <select
              value={formData.tipo_documento}
              onChange={(e) => updateForm('tipo_documento', e.target.value as DespesaTipoDocumento | '')}
              className="select"
            >
              <option value="">— Nenhum —</option>
              <option value="NOTA_FISCAL">Nota Fiscal</option>
              <option value="BOLETO">Boleto</option>
              <option value="RECIBO">Recibo</option>
              <option value="FATURA">Fatura</option>
              <option value="GUIA">Guia (DARF, GPS, etc)</option>
              <option value="OUTROS">Outros</option>
            </select>
            <FieldHint>Que tipo de comprovante está vinculado a essa despesa.</FieldHint>
          </div>

          <div>
            <label className="label">Nº do documento</label>
            <input
              value={formData.numero_documento}
              onChange={(e) => updateForm('numero_documento', e.target.value)}
              className="input"
              placeholder="Ex: NF-001234, Boleto 7890..."
            />
            <FieldHint>Número de identificação do documento para controle e auditorias.</FieldHint>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
           SEÇÃO 5: Observações
         ═══════════════════════════════════════════════════════════════ */}
      <section>
        <label className="label">Observações internas</label>
        <textarea
          value={formData.observacoes}
          onChange={(e) => updateForm('observacoes', e.target.value)}
          className="input min-h-[90px] resize-y"
          placeholder="Anotações extras, justificativas, detalhes do contrato, etc."
        />
        <FieldHint>
          Texto livre para anotações internas. Não aparece em documentos externos.
        </FieldHint>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
           BOTÕES
         ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-secondary-200">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1 py-3"
          disabled={saving}
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary flex-1 py-3"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : mode === 'create' ? (
            'Cadastrar Despesa'
          ) : (
            'Salvar Alterações'
          )}
        </button>
      </div>
    </form>
  );
}