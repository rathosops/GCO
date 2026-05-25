// src/features/financeiro/components/DespesaCard.tsx
import { motion } from 'framer-motion';
import {
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Repeat,
  Building2,
  FileText,
  Pencil,
} from 'lucide-react';
import type { Despesa } from '@/types/despesas.types';
import { formatCurrencyBRL } from '@/utils/formatters';
import {
  CATEGORIA_LABELS,
  STATUS_LABELS,
  RECORRENCIA_LABELS,
  FORMA_PAGAMENTO_LABELS,
} from '@/types/despesas.types';

interface DespesaCardProps {
  despesa: Despesa;
  index?: number;
  onEdit: (d: Despesa) => void;
  onDelete: (id: number) => void;
  onPagar: (d: Despesa) => void;
  onCancelar: (d: Despesa) => void;
}

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  PENDENTE: { bg: 'bg-amber-100', text: 'text-amber-800', icon: <Clock className="h-3.5 w-3.5" /> },
  PAGA: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  CANCELADA: { bg: 'bg-secondary-100', text: 'text-secondary-600', icon: <XCircle className="h-3.5 w-3.5" /> },
  ATRASADA: { bg: 'bg-red-100', text: 'text-red-800', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  PARCIAL: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <Clock className="h-3.5 w-3.5" /> },
};

export default function DespesaCard({
  despesa,
  index = 0,
  onEdit,
  onDelete,
  onPagar,
  onCancelar,
}: DespesaCardProps) {
  const d = despesa;
  const valor = Number(d.valor || 0);
  const valorLiquido = d.valor_liquido ?? valor;
  const isPaga = d.status === 'PAGA';
  const isCancelada = d.status === 'CANCELADA';
  const isAtrasada = d.status === 'ATRASADA';

  const catLabel = CATEGORIA_LABELS[d.categoria as keyof typeof CATEGORIA_LABELS] || d.categoria;
  const statusLabel = STATUS_LABELS[d.status as keyof typeof STATUS_LABELS] || d.status;
  const recLabel = RECORRENCIA_LABELS[d.recorrencia as keyof typeof RECORRENCIA_LABELS] || d.recorrencia;
  const statusStyle = STATUS_STYLES[d.status] || STATUS_STYLES.PENDENTE;

  // Cálculo de dias para vencimento
  const diasVenc = daysUntil(d.data_vencimento);
  let vencLabel = '';
  if (!isPaga && !isCancelada && diasVenc !== null) {
    if (diasVenc < 0) vencLabel = `${Math.abs(diasVenc)} dia(s) atrasado`;
    else if (diasVenc === 0) vencLabel = 'Vence hoje';
    else if (diasVenc <= 7) vencLabel = `Vence em ${diasVenc} dia(s)`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className={[
        'card-interactive',
        isCancelada && 'opacity-50',
        isAtrasada && 'ring-2 ring-red-200',
      ].filter(Boolean).join(' ')}
    >
      {/* Header: badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status badge */}
            <span className={`text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1 font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
              {statusStyle.icon}
              {statusLabel}
            </span>

            {/* Categoria */}
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 font-medium">
              {catLabel}
            </span>

            {/* Fixo/Variável */}
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-600">
              {d.tipo_custo === 'FIXO' ? 'Custo Fixo' : 'Custo Variável'}
            </span>

            {/* Recorrência */}
            {d.recorrencia !== 'UNICA' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 inline-flex items-center gap-1">
                <Repeat className="h-3 w-3" />
                {recLabel}
              </span>
            )}
          </div>

          {/* Descrição */}
          <p className="text-sm font-semibold text-secondary-900 leading-snug" title={d.descricao}>
            {d.descricao}
          </p>

          {/* Datas inline */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-secondary-500">
            <span title="Data de vencimento do pagamento">
              Vencimento: <strong className="text-secondary-700">{formatDateBR(d.data_vencimento)}</strong>
            </span>
            <span title="Mês/ano de competência da despesa">
              Competência: <strong className="text-secondary-700">{formatDateBR(d.data_competencia)}</strong>
            </span>
            {d.data_pagamento && (
              <span className="text-green-600" title="Data em que foi efetivamente pago">
                Pago em: <strong>{formatDateBR(d.data_pagamento)}</strong>
              </span>
            )}
          </div>

          {/* Alerta de vencimento */}
          {vencLabel && (
            <p className={`text-xs font-medium inline-flex items-center gap-1 ${diasVenc !== null && diasVenc < 0 ? 'text-red-600' : 'text-amber-600'}`}>
              <AlertTriangle className="h-3 w-3" />
              {vencLabel}
            </p>
          )}

          {/* Metadados: fornecedor + documento */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-secondary-400">
            {d.fornecedor_nome && (
              <span className="inline-flex items-center gap-1" title="Fornecedor/prestador que emitiu a cobrança">
                <Building2 className="h-3 w-3" />
                {d.fornecedor_nome}
              </span>
            )}
            {d.numero_documento && (
              <span className="inline-flex items-center gap-1" title="Número do documento fiscal vinculado">
                <FileText className="h-3 w-3" />
                {d.tipo_documento || 'Doc'}: {d.numero_documento}
              </span>
            )}
            {d.forma_pagamento && isPaga && (
              <span title="Forma de pagamento utilizada">
                Pago via {FORMA_PAGAMENTO_LABELS[d.forma_pagamento as keyof typeof FORMA_PAGAMENTO_LABELS] || d.forma_pagamento}
              </span>
            )}
          </div>
        </div>

        {/* Valores à direita */}
        <div className="text-right flex-shrink-0 space-y-0.5">
          <p className="text-lg font-bold text-secondary-900">{formatCurrencyBRL(valor)}</p>

          {d.valor_desconto && Number(d.valor_desconto) > 0 && (
            <p className="text-xs text-green-600">Desc: − {formatCurrencyBRL(d.valor_desconto)}</p>
          )}
          {d.valor_juros_multa && Number(d.valor_juros_multa) > 0 && (
            <p className="text-xs text-red-600">Juros: + {formatCurrencyBRL(d.valor_juros_multa)}</p>
          )}
          {valorLiquido !== valor && (
            <p className="text-xs font-semibold text-primary-600">Líq. {formatCurrencyBRL(valorLiquido)}</p>
          )}
          {d.valor_pago != null && isPaga && (
            <p className="text-xs text-green-700 font-semibold">Pago: {formatCurrencyBRL(d.valor_pago)}</p>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-3 border-t border-secondary-100">
        {!isPaga && !isCancelada && (
          <button
            type="button"
            className="btn-primary flex-1 text-sm inline-flex items-center justify-center gap-1.5"
            onClick={() => onPagar(despesa)}
            title="Marcar esta despesa como paga"
          >
            <CheckCircle2 className="h-4 w-4" />
            Pagar
          </button>
        )}

        <button
          type="button"
          className="btn-outline flex-1 text-sm inline-flex items-center justify-center gap-1.5"
          onClick={() => onEdit(despesa)}
          disabled={isCancelada}
          title="Editar os dados desta despesa"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </button>

        {!isPaga && !isCancelada && (
          <button
            type="button"
            className="btn-secondary flex-1 text-sm inline-flex items-center justify-center gap-1.5"
            onClick={() => onCancelar(despesa)}
            title="Cancelar esta despesa (não poderá ser paga depois)"
          >
            <XCircle className="h-4 w-4" />
            Cancelar
          </button>
        )}

        <button
          type="button"
          className="btn-danger text-sm flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5"
          onClick={() => d.id && onDelete(d.id)}
          title="Excluir permanentemente esta despesa"
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </button>
      </div>
    </motion.div>
  );
}
