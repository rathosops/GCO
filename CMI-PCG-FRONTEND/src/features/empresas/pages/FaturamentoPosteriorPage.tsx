/**
 * Página principal do módulo Faturamento Posterior.
 *
 * Dois estados:
 *   - Lista: grid de empresas com faturamento posterior ativo
 *   - Detalhe: histórico de pacientes, resumo financeiro, download PDFs
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Calendar,
  DollarSign,
  Loader2,
  Plus,
  Receipt,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast";
import {
  useFaturamentoEmpresas,
  useFaturamentoMutations,
} from "../hooks/useFaturamentoPosterior";
import { FaturamentoEmpresaDetail } from "../components/FaturamentoEmpresaDetail";
import { FaturamentoConfigModal } from "../components/FaturamentoConfigModal";
import type { Empresa, FaturamentoConfig } from "../types";

// ── Helpers ──────────────────────────────────────────────────
const currency = (v: number | null | undefined) =>
  `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════
export default function FaturamentoPosteriorPage() {
  const toast = useToast();
  const { empresas, total, loading, search, setSearch, reload } =
    useFaturamentoEmpresas();
  const { saving, updateConfig } = useFaturamentoMutations();

  // State
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [configTarget, setConfigTarget] = useState<Empresa | null>(null);

  // Handlers
  const handleSearch = useCallback(
    (term: string) => setSearch(term),
    [setSearch],
  );

  const handleSaveConfig = async (config: Partial<FaturamentoConfig>) => {
    if (!configTarget) return;
    try {
      await updateConfig(configTarget.id, config);
      setConfigTarget(null);
      toast.success("Configuração salva com sucesso!");
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ── Detalhe ──────────────────────────────────────────
  if (selectedEmpresa) {
    return (
      <FaturamentoEmpresaDetail
        empresa={selectedEmpresa}
        onBack={() => {
          setSelectedEmpresa(null);
          reload();
        }}
        onConfigSaved={reload}
      />
    );
  }

  // ── Lista ────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl">
              <Receipt className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Faturamento Posterior
              </h2>
              <p className="text-slate-500">
                {total} empresa{total !== 1 ? "s" : ""} com cobrança consolidada
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Explicação contextual */}
      <div className="card p-4 bg-emerald-50 border-emerald-200">
        <p className="text-sm text-emerald-800">
          <strong>Faturamento posterior:</strong> empresas cujos pacientes são
          atendidos gratuitamente na clínica. Ao final do período, é emitido um
          relatório com todos os atendimentos realizados e um recibo de cobrança
          consolidado com os valores acordados por consulta e ASO.
        </p>
      </div>

      {/* Busca */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar empresa por nome ou razão social..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
        </div>
      ) : empresas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {empresas.map((emp, index) => (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="card group cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedEmpresa(emp)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors">
                    <Building2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {emp.nome}
                    </h3>
                    <p className="text-xs text-slate-500">{emp.cnpj}</p>
                  </div>
                </div>

                {/* Config button */}
                <div
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfigTarget(emp);
                  }}
                >
                  <button
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Configurar faturamento"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Badges de valores */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {emp.dia_faturamento && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Dia {emp.dia_faturamento}
                  </span>
                )}
                {emp.valor_por_consulta != null && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    Consulta: {currency(emp.valor_por_consulta)}
                  </span>
                )}
                {emp.valor_por_aso != null && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    ASO: {currency(emp.valor_por_aso)}
                  </span>
                )}
              </div>

              {/* Observações de faturamento */}
              {emp.observacoes_faturamento && (
                <p className="text-xs text-slate-500 italic mb-3 line-clamp-2">
                  {emp.observacoes_faturamento}
                </p>
              )}

              {/* Info adicional */}
              <div className="space-y-1.5 text-xs text-slate-600">
                {emp.contato_rh_nome && (
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span>RH: {emp.contato_rh_nome}</span>
                  </div>
                )}
                {emp.cidade && emp.uf && (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    {emp.cidade}/{emp.uf}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-2 border-t border-slate-100">
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Clique para ver atendimentos e gerar cobrança
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-16">
            <Receipt className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-lg font-semibold text-slate-700 mb-1">
              Nenhuma empresa com faturamento posterior
            </p>
            <p className="text-sm text-slate-500 text-center max-w-md">
              {search
                ? "Nenhuma empresa encontrada com esse termo."
                : "Para ativar o faturamento posterior, edite uma empresa no módulo Empresas e habilite a opção na aba de configurações."}
            </p>
          </div>
        </div>
      )}

      {/* Config Modal */}
      <AnimatePresence>
        {configTarget && (
          <FaturamentoConfigModal
            isOpen={!!configTarget}
            onClose={() => setConfigTarget(null)}
            onSubmit={handleSaveConfig}
            empresa={configTarget}
            saving={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
