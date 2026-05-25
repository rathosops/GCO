/**
 * Detalhe do faturamento posterior de uma empresa.
 *
 * Exibe: seletor de período, KPIs financeiros, tabela de pacientes
 * com histórico expandível, ações de download de relatório e recibo PDF.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Download,
  FileText,
  Loader2,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast";
import {
  useFaturamentoDetalhe,
  useFaturamentoMutations,
} from "../hooks/useFaturamentoPosterior";
import { FaturamentoConfigModal } from "./FaturamentoConfigModal";
import type { Empresa, FaturamentoPaciente, FaturamentoConfig } from "../types";

// ── Helpers ──────────────────────────────────────────────────
const currency = (v: number | null | undefined) =>
  `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateBR = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

// ── Props ────────────────────────────────────────────────────
interface Props {
  empresa: Empresa;
  onBack: () => void;
  onConfigSaved: () => void;
}

// ── Paciente row expandível ──────────────────────────────────
function PacienteRow({ paciente }: { paciente: FaturamentoPaciente }) {
  const [open, setOpen] = useState(false);
  const hasContent =
    paciente.consultas.length > 0 ||
    paciente.asos.length > 0 ||
    paciente.questionarios.length > 0;

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      {/* Header do paciente */}
      <button
        type="button"
        onClick={() => hasContent && setOpen(!open)}
        className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
          hasContent ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"
        }`}
      >
        {hasContent ? (
          open ? (
            <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
          )
        ) : (
          <div className="w-4" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {paciente.nome}
          </p>
          <p className="text-xs text-slate-500">{paciente.cpf_formatado}</p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600 flex-shrink-0">
          <span className="flex items-center gap-1" title="Consultas">
            <Stethoscope className="h-3.5 w-3.5 text-blue-500" />
            {paciente.total_consultas}
          </span>
          <span className="flex items-center gap-1" title="ASOs">
            <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
            {paciente.total_asos}
          </span>
          <span className="flex items-center gap-1" title="Questionários">
            <ClipboardList className="h-3.5 w-3.5 text-violet-500" />
            {paciente.total_questionarios}
          </span>
        </div>

        <span
          className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
            paciente.possui_atendimento
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {paciente.possui_atendimento ? "Atendido" : "Pendente"}
        </span>
      </button>

      {/* Detalhes expandidos */}
      <AnimatePresence>
        {open && hasContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
              {/* Consultas */}
              {paciente.consultas.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-blue-600 mb-1.5 flex items-center gap-1">
                    <Stethoscope className="h-3.5 w-3.5" />
                    Consultas ({paciente.consultas.length})
                  </p>
                  <div className="space-y-1">
                    {paciente.consultas.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 text-xs text-slate-600 py-1 px-2 bg-blue-50/50 rounded-lg"
                      >
                        <span className="font-medium text-slate-700 w-20">
                          {dateBR(c.data)}
                        </span>
                        <span className="w-12 text-slate-500">
                          {c.hora ?? "—"}
                        </span>
                        <span className="flex-1 truncate">{c.tipo ?? "—"}</span>
                        <span className="text-slate-400 truncate max-w-[120px]">
                          {c.medico ?? ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ASOs */}
              {paciente.asos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-600 mb-1.5 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    ASOs ({paciente.asos.length})
                  </p>
                  <div className="space-y-1">
                    {paciente.asos.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 text-xs text-slate-600 py-1 px-2 bg-green-50/50 rounded-lg"
                      >
                        <span className="font-medium text-slate-700 w-20">
                          {dateBR(a.data)}
                        </span>
                        <span className="flex-1">{a.tipo_exame}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            a.conclusao === "APTO"
                              ? "bg-green-100 text-green-700"
                              : a.conclusao === "INAPTO"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {a.conclusao}
                        </span>
                        <span className="text-slate-400 truncate max-w-[120px]">
                          {a.medico ?? ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Questionários */}
              {paciente.questionarios.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-violet-600 mb-1.5 flex items-center gap-1">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Questionários ({paciente.questionarios.length})
                  </p>
                  <div className="space-y-1">
                    {paciente.questionarios.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center gap-3 text-xs text-slate-600 py-1 px-2 bg-violet-50/50 rounded-lg"
                      >
                        <span className="font-medium text-slate-700 w-20">
                          {dateBR(q.created_at?.split("T")[0])}
                        </span>
                        <span className="flex-1">{q.origem}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
                          {q.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENT PRINCIPAL
// ══════════════════════════════════════════════════════════════
export function FaturamentoEmpresaDetail({
  empresa,
  onBack,
  onConfigSaved,
}: Props) {
  const toast = useToast();
  const { historico, resumo, periodo, setPeriodo, loading, reload } =
    useFaturamentoDetalhe(empresa.id);
  const {
    saving,
    downloading,
    updateConfig,
    downloadRelatorio,
    downloadRecibo,
  } = useFaturamentoMutations();

  const [configModal, setConfigModal] = useState(false);
  const [searchPac, setSearchPac] = useState("");

  // Filtro local de pacientes por nome/CPF
  const pacientesFiltrados = (historico?.pacientes ?? []).filter((p) => {
    if (!searchPac) return true;
    const term = searchPac.toLowerCase();
    return (
      p.nome.toLowerCase().includes(term) ||
      p.cpf_formatado.includes(term) ||
      p.cpf.includes(term.replace(/\D/g, ""))
    );
  });

  const handleSaveConfig = async (config: Partial<FaturamentoConfig>) => {
    try {
      await updateConfig(empresa.id, config);
      setConfigModal(false);
      toast.success("Configuração de faturamento salva!");
      onConfigSaved();
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDownloadRelatorio = async () => {
    try {
      await downloadRelatorio(empresa.id, periodo, empresa.nome);
      toast.success("Relatório gerado com sucesso!");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDownloadRecibo = async () => {
    try {
      await downloadRecibo(empresa.id, periodo, empresa.nome);
      toast.success("Recibo gerado com sucesso!");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="btn-ghost">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 truncate">
              {empresa.nome}
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
              Faturamento Posterior
            </span>
          </div>
          <p className="text-sm text-slate-500">
            CNPJ {empresa.cnpj}
            {empresa.dia_faturamento
              ? ` · Corte dia ${empresa.dia_faturamento}`
              : ""}
            {empresa.valor_por_consulta
              ? ` · Consulta: ${currency(empresa.valor_por_consulta)}`
              : ""}
            {empresa.valor_por_aso
              ? ` · ASO: ${currency(empresa.valor_por_aso)}`
              : ""}
          </p>
        </div>
        <button
          onClick={() => setConfigModal(true)}
          className="btn-secondary text-sm"
        >
          <Settings className="h-4 w-4" /> Configurar
        </button>
      </div>

      {/* ── Seletor de período ─────────────────────── */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="font-medium">Período:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="input text-sm w-auto"
              value={periodo.data_inicio}
              onChange={(e) =>
                setPeriodo((p) => ({ ...p, data_inicio: e.target.value }))
              }
            />
            <span className="text-slate-400">até</span>
            <input
              type="date"
              className="input text-sm w-auto"
              value={periodo.data_fim}
              onChange={(e) =>
                setPeriodo((p) => ({ ...p, data_fim: e.target.value }))
              }
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleDownloadRelatorio}
              disabled={downloading || loading}
              className="btn-secondary text-sm"
              title="Relatório de atendimentos em PDF"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Relatório
            </button>
            <button
              onClick={handleDownloadRecibo}
              disabled={downloading || loading}
              className="btn-primary text-sm"
              title="Recibo de cobrança em PDF"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Receipt className="h-4 w-4" />
              )}
              Recibo
            </button>
          </div>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                label: "Pacientes vinculados",
                value: historico?.total_pacientes ?? 0,
                icon: Users,
                color: "bg-slate-100 text-slate-600",
              },
              {
                label: "Atendidos no período",
                value: historico?.total_pacientes_atendidos ?? 0,
                icon: Stethoscope,
                color: "bg-blue-100 text-blue-600",
              },
              {
                label: "Consultas",
                value: resumo?.total_consultas ?? 0,
                icon: Stethoscope,
                color: "bg-cyan-100 text-cyan-600",
              },
              {
                label: "ASOs emitidos",
                value: resumo?.total_asos ?? 0,
                icon: ShieldCheck,
                color: "bg-green-100 text-green-600",
              },
              {
                label: "Total a faturar",
                value: currency(resumo?.total_geral),
                icon: DollarSign,
                color: "bg-emerald-100 text-emerald-600",
                isMoney: true,
              },
            ].map((kpi) => (
              <div key={kpi.label} className="card p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${kpi.color}`}>
                    <kpi.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      {kpi.label}
                    </p>
                    <p
                      className={`font-bold ${
                        kpi.isMoney
                          ? "text-emerald-700 text-base"
                          : "text-slate-900 text-lg"
                      }`}
                    >
                      {kpi.value}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Resumo financeiro ───────────────────── */}
          {resumo && (resumo.total_consultas > 0 || resumo.total_asos > 0) && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Resumo Financeiro
              </h3>
              <div className="table-container">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-xs font-semibold text-slate-500">
                        Item
                      </th>
                      <th className="text-center p-2 text-xs font-semibold text-slate-500">
                        Qtd.
                      </th>
                      <th className="text-right p-2 text-xs font-semibold text-slate-500">
                        Valor Unit.
                      </th>
                      <th className="text-right p-2 text-xs font-semibold text-slate-500">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100">
                      <td className="p-2 text-slate-700">
                        Consultas realizadas
                      </td>
                      <td className="p-2 text-center">
                        {resumo.total_consultas}
                      </td>
                      <td className="p-2 text-right">
                        {currency(resumo.empresa.valor_por_consulta)}
                      </td>
                      <td className="p-2 text-right font-medium">
                        {currency(resumo.subtotal_consultas)}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="p-2 text-slate-700">ASOs emitidos</td>
                      <td className="p-2 text-center">{resumo.total_asos}</td>
                      <td className="p-2 text-right">
                        {currency(resumo.empresa.valor_por_aso)}
                      </td>
                      <td className="p-2 text-right font-medium">
                        {currency(resumo.subtotal_asos)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300">
                      <td
                        colSpan={3}
                        className="p-2 text-right font-bold text-slate-800"
                      >
                        TOTAL A FATURAR
                      </td>
                      <td className="p-2 text-right font-bold text-emerald-700 text-base">
                        {currency(resumo.total_geral)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── Pacientes ───────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">
                Pacientes vinculados ({pacientesFiltrados.length})
              </h3>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  className="input pl-9 text-sm"
                  placeholder="Filtrar por nome ou CPF..."
                  value={searchPac}
                  onChange={(e) => setSearchPac(e.target.value)}
                />
              </div>
            </div>

            {pacientesFiltrados.length === 0 ? (
              <div className="card p-8 text-center">
                <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  Nenhum paciente encontrado para o período selecionado.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pacientesFiltrados.map((p) => (
                  <PacienteRow key={p.id} paciente={p} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Config Modal ────────────────────────────── */}
      <FaturamentoConfigModal
        isOpen={configModal}
        onClose={() => setConfigModal(false)}
        onSubmit={handleSaveConfig}
        empresa={empresa}
        saving={saving}
      />
    </div>
  );
}
