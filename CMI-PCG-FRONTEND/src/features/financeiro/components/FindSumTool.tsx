// src/features/financeiro/components/FindSumTool.tsx
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator,
  Search,
  Loader2,
  Check,
  AlertCircle,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { analyticsAPI } from '@/services/analytics.api';
import type { FindSumFilters, FindSumResult, FindSumCombination } from '@/types/analytics.types';

function moneyBR(value: number): string {
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return `R$ ${Number(value || 0).toFixed(2)}`;
  }
}

interface CombinationCardProps {
  combination: FindSumCombination;
  index: number;
  valorAlvo: number;
}

function CombinationCard({ combination, index, valorAlvo }: CombinationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isExact = Math.abs(combination.diferenca) < 0.01;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`border rounded-xl overflow-hidden ${
        isExact
          ? 'border-green-200 bg-green-50'
          : 'border-secondary-200 bg-white'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
        type="button"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            isExact
              ? 'bg-green-200 text-green-800'
              : 'bg-secondary-200 text-secondary-700'
          }`}>
            {index + 1}
          </div>

          <div>
            <p className="font-semibold text-secondary-900">
              {combination.quantidade} pagamento{combination.quantidade > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-secondary-600">
              Soma: {moneyBR(combination.soma)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isExact ? (
            <span className="flex items-center gap-1 px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-medium">
              <Check className="h-3 w-3" />
              Exato
            </span>
          ) : (
            <span className="text-sm text-secondary-500">
              Diferença: {moneyBR(Math.abs(combination.diferenca))}
            </span>
          )}
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-secondary-100">
              <div className="mt-3 space-y-2">
                {combination.pagamentos.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-secondary-100"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-secondary-900 truncate">
                        {p.nome}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-secondary-500">{p.data}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-secondary-100 rounded">
                          {p.tipo}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-primary-600">
                      {moneyBR(p.valor)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 p-3 bg-secondary-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary-600">Soma total:</span>
                  <span className="font-bold text-secondary-900">{moneyBR(combination.soma)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-secondary-600">Valor alvo:</span>
                  <span className="font-medium text-secondary-700">{moneyBR(valorAlvo)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1 pt-2 border-t border-secondary-200">
                  <span className="text-secondary-600">Diferença:</span>
                  <span className={`font-bold ${isExact ? 'text-green-600' : 'text-amber-600'}`}>
                    {isExact ? 'R$ 0,00' : moneyBR(combination.diferenca)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FindSumTool() {
  const [filters, setFilters] = useState<FindSumFilters>({
    valor_alvo: 0,
    tolerancia: 0.01,
    max_pagamentos: 5,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FindSumResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateFilter = useCallback(<K extends keyof FindSumFilters>(
    key: K,
    value: FindSumFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSearch = useCallback(async () => {
    if (!filters.valor_alvo || filters.valor_alvo <= 0) {
      setError('Informe um valor alvo maior que zero.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Remove campos vazios
      const params: FindSumFilters = { ...filters };
      Object.keys(params).forEach((key) => {
        const k = key as keyof FindSumFilters;
        if (params[k] === '' || params[k] === undefined || params[k] === null) {
          delete params[k];
        }
      });

      const data = await analyticsAPI.findSum(params);
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao buscar combinações');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  return (
    <div className="space-y-4">
      {/* Configuração */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-bold text-secondary-900">Encontrar Soma</h3>
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="btn-secondary text-sm"
            type="button"
          >
            {showAdvanced ? 'Menos opções' : 'Mais opções'}
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Info box */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Como funciona?</p>
            <p className="mt-1">
              Esta ferramenta encontra combinações de pagamentos que somam (ou se aproximam de)
              um valor específico. Útil para conciliação financeira e identificação de grupos de
              transações.
            </p>
          </div>
        </div>

        {/* Valor alvo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="label">Valor alvo *</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex: 1500.00"
                value={filters.valor_alvo || ''}
                onChange={(e) => updateFilter('valor_alvo', e.target.value ? Number(e.target.value) : 0)}
                className="input pl-11 text-lg font-medium"
              />
            </div>
          </div>

          <div>
            <label className="label">Máx. pagamentos</label>
            <select
              value={filters.max_pagamentos ?? 5}
              onChange={(e) => updateFilter('max_pagamentos', Number(e.target.value))}
              className="select"
            >
              <option value={2}>2 pagamentos</option>
              <option value={3}>3 pagamentos</option>
              <option value={4}>4 pagamentos</option>
              <option value={5}>5 pagamentos</option>
              <option value={6}>6 pagamentos</option>
              <option value={7}>7 pagamentos</option>
            </select>
          </div>
        </div>

        {/* Opções avançadas */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-secondary-100">
                <div>
                  <label className="label">Tolerância (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.01"
                    value={filters.tolerancia ?? ''}
                    onChange={(e) => updateFilter('tolerancia', e.target.value ? Number(e.target.value) : undefined)}
                    className="input"
                  />
                  <p className="text-xs text-secondary-500 mt-1">Diferença máxima aceita</p>
                </div>

                <div>
                  <label className="label">Data específica</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                    <input
                      type="date"
                      value={filters.data ?? ''}
                      onChange={(e) => updateFilter('data', e.target.value || undefined)}
                      className="input pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Data início</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                    <input
                      type="date"
                      value={filters.data_inicio ?? ''}
                      onChange={(e) => updateFilter('data_inicio', e.target.value || undefined)}
                      className="input pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Data fim</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                    <input
                      type="date"
                      value={filters.data_fim ?? ''}
                      onChange={(e) => updateFilter('data_fim', e.target.value || undefined)}
                      className="input pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">CPF do paciente</label>
                  <input
                    type="text"
                    placeholder="Somente números"
                    value={filters.cpf ?? ''}
                    onChange={(e) => updateFilter('cpf', e.target.value || undefined)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">ID da empresa</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="ID numérico"
                    value={filters.empresa_id ?? ''}
                    onChange={(e) => updateFilter('empresa_id', e.target.value ? Number(e.target.value) : undefined)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">ID do convênio</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="ID numérico"
                    value={filters.convenio_id ?? ''}
                    onChange={(e) => updateFilter('convenio_id', e.target.value ? Number(e.target.value) : undefined)}
                    className="input"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botão de busca */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSearch}
            className="btn-primary"
            disabled={loading || !filters.valor_alvo || filters.valor_alvo <= 0}
            type="button"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            Buscar combinações
          </button>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-light border border-danger/20 text-danger">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Resultados */}
      {result && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-bold text-secondary-900">
                {result.total_encontradas} combinação{result.total_encontradas !== 1 ? 'ões' : ''} encontrada{result.total_encontradas !== 1 ? 's' : ''}
              </h4>
              <p className="text-sm text-secondary-500">
                Valor alvo: {moneyBR(result.valor_alvo)} | Tolerância: {moneyBR(result.tolerancia)}
              </p>
            </div>
          </div>

          {result.combinacoes?.length > 0 ? (
            <div className="space-y-3">
              {result.combinacoes.map((comb, index) => (
                <CombinationCard
                  key={index}
                  combination={comb}
                  index={index}
                  valorAlvo={result.valor_alvo}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state py-8">
              <Calculator className="empty-state-icon" />
              <p className="empty-state-title">Nenhuma combinação encontrada</p>
              <p className="empty-state-description">
                Tente ajustar o valor alvo, aumentar a tolerância ou o número máximo de pagamentos.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}