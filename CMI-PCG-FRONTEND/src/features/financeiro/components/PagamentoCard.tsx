// src/features/financeiro/components/PagamentoCard.tsx
import { motion } from 'framer-motion';
import { Trash2, FileText, Receipt } from 'lucide-react';
import { Pagamento } from '@/types';

interface PagamentoCardProps {
  pagamento: Pagamento;
  index?: number;
  onEdit: (pagamento: Pagamento) => void;
  onDelete: (id: number) => void;
  onViewNotaFiscal: (pagamento: Pagamento) => void;
}

function moneyBR(value: number): string {
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return `R$ ${Number(value || 0).toFixed(2)}`;
  }
}

function labelPFJ(v: string) {
  if (v === 'PF') return 'PF - Pessoa Física';
  if (v === 'PJ') return 'PJ - Pessoa Jurídica';
  return v;
}

export default function PagamentoCard({
  pagamento,
  index = 0,
  onEdit,
  onDelete,
  onViewNotaFiscal,
}: PagamentoCardProps) {
  const p = pagamento as any;
  const valor = Number(p.valor || 0);
  const valorDesconto = Number(p.valor_desconto || 0);
  const valorLiquido = p.valor_liquido ?? (valor - valorDesconto);

  const nomeExibicao = p.nome_do_paciente || p.nome_empresa || p.nome_convenio || '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="card-interactive"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Tipo e origem */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-secondary-900">
              {p.tipo}
            </span>

            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-700">
              {p.origem}
            </span>

            {p.qtd_parcelas_credito && p.tipo === 'CRÉDITO' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                {p.qtd_parcelas_credito}x
              </span>
            )}

            {/* PIX: PF/PJ pagador */}
            {p.tipo === 'PIX' && p.tipo_pessoa_pix && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                Pagador: {labelPFJ(p.tipo_pessoa_pix)}
              </span>
            )}

            {/* PIX: conta destino */}
            {p.tipo === 'PIX' && p.conta_destinada_pix && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-50 text-secondary-700 border border-secondary-200">
                Conta: {labelPFJ(p.conta_destinada_pix)}
              </span>
            )}

            {/* Nota fiscal vinculada */}
            {p.vinculado_nota_fiscal && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 inline-flex items-center gap-1">
                <Receipt className="h-3 w-3" />
                NF: {p.numero_nota_fiscal || '—'}
              </span>
            )}
          </div>

          {/* Data */}
          <p className="text-xs text-secondary-500 mt-1">{p.data}</p>

          {/* Nome */}
          <p className="text-sm text-secondary-700 mt-2 truncate" title={nomeExibicao}>
            {nomeExibicao}
          </p>

          {/* Descrição */}
          {p.descricao && (
            <p className="text-xs text-secondary-500 mt-1 truncate" title={p.descricao}>
              {p.descricao}
            </p>
          )}
        </div>

        {/* Valores */}
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-secondary-900">
            {moneyBR(valor)}
          </p>
          {valorDesconto > 0 ? (
            <>
              <p className="text-xs text-danger">
                - {moneyBR(valorDesconto)}
              </p>
              <p className="text-xs text-success font-medium">
                Líq. {moneyBR(valorLiquido)}
              </p>
            </>
          ) : (
            <p className="text-xs text-secondary-500">sem desconto</p>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-secondary-100">
        <button
          type="button"
          className="btn-secondary flex-1 text-sm inline-flex items-center justify-center gap-1"
          onClick={() => onViewNotaFiscal(pagamento)}
        >
          <FileText className="h-4 w-4" />
          Nota fiscal
        </button>

        <button
          type="button"
          className="btn-outline flex-1 text-sm"
          onClick={() => onEdit(pagamento)}
        >
          Editar
        </button>

        <button
          type="button"
          className="btn-danger text-sm flex-1 sm:flex-initial inline-flex items-center justify-center gap-1"
          onClick={() => p.id && onDelete(p.id)}
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </button>
      </div>
    </motion.div>
  );
}