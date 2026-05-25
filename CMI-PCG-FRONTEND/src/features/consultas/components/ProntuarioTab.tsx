import { initialFrom } from "@/utils/initials";
// src/features/consultas/components/ProntuarioTab.tsx

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  User,
  FileText,
  Calendar,
  Clock,
  Stethoscope,
  Pill,
  FlaskConical,
  Download,
  ChevronDown,
  ChevronUp,
  Loader2,
  Phone,
  Mail,
  Building2,
  Shield,
  MapPin,
  Heart,
  AlertCircle,
  X,
  Filter,
} from "lucide-react";
import { useProntuario, usePacienteSearch } from "../hooks/useProntuario";
import { pacientesAPI } from "@/services/api";
import { useToast } from "@/components/feedback/toast";
import { debounce } from "@/utils/debounce";
import { onlyDigits, formatCpf } from "@/utils/formatters";
import type { ProntuarioConsulta, Paciente } from "@/types";
import type { AutocompletePaciente } from "@/services/autocomplete.api";

// =============================================================================
// Tipos locais
// =============================================================================
interface ProntuarioFilters {
  data_inicio: string;
  data_fim: string;
  tipo: string;
  busca: string;
}

// =============================================================================
// Helpers
// =============================================================================
function calcularIdade(dataNasc: string | null | undefined): number | null {
  if (!dataNasc) return null;
  const nascimento = new Date(dataNasc);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("pt-BR");
  } catch {
    return date;
  }
}

// =============================================================================
// Componente Principal
// =============================================================================
export function ProntuarioTab() {
  const toast = useToast();
  const { prontuario, loading, error, loadProntuario, clear } = useProntuario();
  const {
    results: pacientes,
    loading: searchLoading,
    search: searchPacientes,
    clear: clearSearch,
  } = usePacienteSearch();

  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedPaciente, setSelectedPaciente] =
    useState<AutocompletePaciente | null>(null);

  const [filters, setFilters] = useState<ProntuarioFilters>({
    data_inicio: "",
    data_fim: "",
    tipo: "",
    busca: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Debounce da busca
  const debouncedSearch = useMemo(
    () => debounce((q: string) => searchPacientes(q), 300),
    [searchPacientes],
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  const handleSelectPaciente = useCallback(
    (pac: AutocompletePaciente) => {
      setSelectedPaciente(pac);
      setQuery(pac.nome);
      setShowResults(false);
      clearSearch();

      const cpfDigits = onlyDigits(String(pac.cpf_raw || pac.cpf));
      loadProntuario(cpfDigits);
    },
    [loadProntuario, clearSearch],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedPaciente(null);
    setQuery("");
    clear();
    setFilters({ data_inicio: "", data_fim: "", tipo: "", busca: "" });
  }, [clear]);

  /**
   * Baixa o PDF do prontuário usando o novo endpoint /prontuarios/pdf
   * Envia CPF + filtros ativos para que o PDF reflita a mesma visão da tela
   */
  const handleDownloadPdf = useCallback(async () => {
    // Obtém CPF a partir do paciente selecionado ou do prontuário carregado
    const cpfSource =
      selectedPaciente
        ? String(selectedPaciente.cpf_raw || selectedPaciente.cpf)
        : prontuario?.paciente?.cpf;

    if (!cpfSource) {
      toast.error("Selecione um paciente para gerar o PDF");
      return;
    }

    const cpfDigits = onlyDigits(String(cpfSource));
    if (cpfDigits.length !== 11) {
      toast.error("CPF inválido para gerar PDF");
      return;
    }

    try {
      setDownloadingPdf(true);

      // Monta filtros não-vazios para enviar ao backend
      const pdfFilters: {
        data_inicio?: string;
        data_fim?: string;
        tipo?: string;
        busca?: string;
      } = {};

      if (filters.data_inicio) pdfFilters.data_inicio = filters.data_inicio;
      if (filters.data_fim) pdfFilters.data_fim = filters.data_fim;
      if (filters.tipo) pdfFilters.tipo = filters.tipo;
      if (filters.busca) pdfFilters.busca = filters.busca;

      const blob = await pacientesAPI.downloadProntuarioPdf(
        cpfDigits,
        pdfFilters,
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prontuario_${prontuario?.paciente?.nome?.replace(/\s+/g, "_") || "paciente"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF baixado com sucesso");
    } catch (err) {
      console.error("Erro ao baixar PDF do prontuário:", err);
      toast.error("Erro ao baixar PDF do prontuário");
    } finally {
      setDownloadingPdf(false);
    }
  }, [selectedPaciente, prontuario, filters, toast]);

  // Filtrar consultas localmente
  const consultasFiltradas = useMemo(() => {
    if (!prontuario?.consultas) return [];

    return prontuario.consultas.filter((c) => {
      if (filters.data_inicio && c.data && c.data < filters.data_inicio)
        return false;
      if (filters.data_fim && c.data && c.data > filters.data_fim) return false;
      if (
        filters.tipo &&
        c.tipo &&
        !c.tipo.toLowerCase().includes(filters.tipo.toLowerCase())
      )
        return false;
      if (filters.busca) {
        const termo = filters.busca.toLowerCase();
        const textos = [
          c.anamnese,
          c.procedimentos,
          c.diagnostico ?? null,
          c.conduta ?? null,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!textos.includes(termo)) return false;
      }
      return true;
    });
  }, [prontuario?.consultas, filters]);

  // Tipos únicos para filtro
  const tiposUnicos = useMemo(() => {
    if (!prontuario?.consultas) return [];
    const tipos = new Set(
      prontuario.consultas.map((c) => c.tipo).filter(Boolean),
    );
    return Array.from(tipos) as string[];
  }, [prontuario?.consultas]);

  // Verifica se há filtros ativos (para exibir indicação no botão PDF)
  const hasActiveFilters =
    filters.data_inicio || filters.data_fim || filters.tipo || filters.busca;

  return (
    <div className="space-y-6">
      {/* Barra de Busca */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <FileText className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-secondary-900">
              Prontuário Eletrônico
            </h3>
            <p className="text-sm text-secondary-500">
              Busque um paciente para visualizar o histórico completo
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            className="input pl-10 pr-10"
            placeholder="Digite o nome ou CPF do paciente..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
              if (!e.target.value.trim()) handleClearSelection();
            }}
            onFocus={() => setShowResults(true)}
          />
          {(query || selectedPaciente) && (
            <button
              onClick={handleClearSelection}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-secondary-400 hover:text-secondary-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Dropdown de resultados */}
          <AnimatePresence>
            {showResults && query.length >= 2 && !selectedPaciente && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-50 mt-2 w-full bg-white border border-secondary-200 rounded-xl shadow-lg max-h-80 overflow-y-auto"
              >
                {searchLoading ? (
                  <div className="flex items-center gap-2 p-4 text-secondary-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando pacientes...
                  </div>
                ) : pacientes.length > 0 ? (
                  <div className="py-2">
                    {pacientes.map((pac) => (
                      <button
                        key={pac.id}
                        type="button"
                        onClick={() => handleSelectPaciente(pac)}
                        className="w-full text-left px-4 py-3 hover:bg-secondary-50 transition flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-secondary-900 truncate">
                            {pac.nome}
                          </p>
                          <p className="text-sm text-secondary-500">
                            CPF: {pac.cpf}
                          </p>
                        </div>
                        {pac.empresa_nome && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            {pac.empresa_nome}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-secondary-500 text-center">
                    Nenhum paciente encontrado
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="card">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            <span className="ml-3 text-secondary-600">
              Carregando prontuário...
            </span>
          </div>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Prontuário */}
      {prontuario && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Card do Paciente */}
          <PacienteHeader
            paciente={prontuario.paciente}
            totalConsultas={prontuario.consultas.length}
            totalFiltradas={consultasFiltradas.length}
            hasActiveFilters={!!hasActiveFilters}
            onDownloadPdf={handleDownloadPdf}
            downloadingPdf={downloadingPdf}
          />

          {/* Filtros das Consultas */}
          {prontuario.consultas.length > 0 && (
            <div className="card">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-secondary-500" />
                  <span className="font-medium text-secondary-700">
                    Filtrar Consultas
                  </span>
                  <span className="text-sm text-secondary-500">
                    ({consultasFiltradas.length} de{" "}
                    {prontuario.consultas.length})
                  </span>
                  {hasActiveFilters && (
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded font-medium">
                      Filtros ativos
                    </span>
                  )}
                </div>
                {showFilters ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 mt-4 border-t">
                      <div>
                        <label className="label text-xs">Data Início</label>
                        <input
                          type="date"
                          className="input"
                          value={filters.data_inicio}
                          onChange={(e) =>
                            setFilters((f) => ({
                              ...f,
                              data_inicio: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Data Fim</label>
                        <input
                          type="date"
                          className="input"
                          value={filters.data_fim}
                          onChange={(e) =>
                            setFilters((f) => ({
                              ...f,
                              data_fim: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Tipo</label>
                        <select
                          className="select"
                          value={filters.tipo}
                          onChange={(e) =>
                            setFilters((f) => ({ ...f, tipo: e.target.value }))
                          }
                        >
                          <option value="">Todos</option>
                          {tiposUnicos.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">
                          Buscar no conteúdo
                        </label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Termo..."
                          value={filters.busca}
                          onChange={(e) =>
                            setFilters((f) => ({ ...f, busca: e.target.value }))
                          }
                        />
                      </div>
                    </div>

                    {/* Botão limpar filtros */}
                    {hasActiveFilters && (
                      <div className="flex justify-end mt-3">
                        <button
                          onClick={() =>
                            setFilters({
                              data_inicio: "",
                              data_fim: "",
                              tipo: "",
                              busca: "",
                            })
                          }
                          className="btn-ghost btn-sm text-secondary-600"
                        >
                          <X className="h-3.5 w-3.5" />
                          Limpar filtros
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Timeline de Consultas */}
          {consultasFiltradas.length > 0 ? (
            <div className="space-y-4">
              <h4 className="font-bold text-secondary-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Histórico de Consultas
              </h4>
              {consultasFiltradas.map((consulta, idx) => (
                <ConsultaCard
                  key={consulta.id}
                  consulta={consulta}
                  index={idx}
                />
              ))}
            </div>
          ) : prontuario.consultas.length === 0 ? (
            <div className="card text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-secondary-300 mb-3" />
              <p className="text-secondary-600 font-medium">
                Nenhuma consulta registrada
              </p>
              <p className="text-sm text-secondary-500">
                Este paciente ainda não possui consultas no sistema.
              </p>
            </div>
          ) : (
            <div className="card text-center py-8">
              <p className="text-secondary-600">
                Nenhuma consulta corresponde aos filtros aplicados.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Estado vazio */}
      {!prontuario && !loading && !error && (
        <div className="card">
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-10 w-10 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">
              Selecione um Paciente
            </h3>
            <p className="text-secondary-500 max-w-md mx-auto">
              Digite o nome ou CPF na barra de busca acima para visualizar o
              prontuário completo do paciente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Subcomponentes
// =============================================================================

interface PacienteHeaderProps {
  paciente: Paciente;
  totalConsultas: number;
  totalFiltradas: number;
  hasActiveFilters: boolean;
  onDownloadPdf: () => void;
  downloadingPdf: boolean;
}

function PacienteHeader({
  paciente,
  totalConsultas,
  totalFiltradas,
  hasActiveFilters,
  onDownloadPdf,
  downloadingPdf,
}: PacienteHeaderProps) {
  const idade = calcularIdade(paciente.data_de_nascimento);

  return (
    <div className="card bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {initialFrom(paciente?.nome, "P")}
          </div>
          <div>
            <h2 className="text-xl font-bold text-secondary-900">
              {paciente.nome}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-secondary-600">
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                CPF: {paciente.cpf}
              </span>
              {idade !== null && (
                <span className="flex items-center gap-1">
                  <Heart className="h-4 w-4" />
                  {idade} anos
                </span>
              )}
              {paciente.sexo && (
                <span>{paciente.sexo === "M" ? "Masculino" : "Feminino"}</span>
              )}
            </div>

            {/* Contatos */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
              {paciente.numero_de_contato && (
                <span className="flex items-center gap-1 text-secondary-600">
                  <Phone className="h-3.5 w-3.5" />
                  {paciente.numero_de_contato}
                </span>
              )}
              {paciente.email && (
                <span className="flex items-center gap-1 text-secondary-600">
                  <Mail className="h-3.5 w-3.5" />
                  {paciente.email}
                </span>
              )}
            </div>

            {/* Vínculos */}
            <div className="flex flex-wrap gap-2 mt-3">
              {paciente.empresa && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                  <Building2 className="h-3 w-3" />
                  {paciente.empresa.nome}
                </span>
              )}
              {paciente.convenio && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                  <Shield className="h-3 w-3" />
                  {paciente.convenio.nome}
                </span>
              )}
            </div>

            {/* Endereço */}
            {paciente.endereco_compacto && (
              <div className="flex items-start gap-1 mt-2 text-sm text-secondary-500">
                <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{paciente.endereco_compacto}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="text-right">
            <p className="text-3xl font-bold text-indigo-600">
              {totalConsultas}
            </p>
            <p className="text-sm text-secondary-500">consultas registradas</p>
          </div>
          <button
            onClick={onDownloadPdf}
            disabled={downloadingPdf}
            className="btn-secondary text-sm"
            title={
              hasActiveFilters
                ? "PDF será gerado com os filtros ativos aplicados"
                : "Gerar PDF completo do prontuário"
            }
          >
            {downloadingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Baixar Prontuário PDF
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded font-medium">
                {totalFiltradas}/{totalConsultas}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConsultaCardProps {
  consulta: ProntuarioConsulta;
  index: number;
}

function ConsultaCard({ consulta, index }: ConsultaCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="card border-l-4 border-l-indigo-500"
    >
      {/* Header */}
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Stethoscope className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-secondary-900">
                {consulta.tipo || "Consulta"}
              </span>
              <span className="px-2 py-0.5 bg-secondary-100 text-secondary-600 text-xs rounded">
                #{consulta.id}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-secondary-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(consulta.data)}
              </span>
              {consulta.hora && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {consulta.hora}
                </span>
              )}
              {consulta.nome_do_medico && (
                <span>Dr(a). {consulta.nome_do_medico}</span>
              )}
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 mt-2">
              {consulta.houve_solicitacao_de_exame && (
                <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                  <FlaskConical className="h-3 w-3" />
                  Exames
                </span>
              )}
              {consulta.houve_prescricao_medicamentos && (
                <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                  <Pill className="h-3 w-3" />
                  Prescrição
                </span>
              )}
            </div>
          </div>
        </div>

        <button className="p-1 text-secondary-400 hover:text-secondary-600">
          {expanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Conteúdo Expandido */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t space-y-4">
              {consulta.queixa_principal && (
                <InfoBlock
                  label="Queixa Principal"
                  value={consulta.queixa_principal}
                />
              )}
              {consulta.historia_doenca_atual && (
                <InfoBlock
                  label="História da Doença Atual"
                  value={consulta.historia_doenca_atual}
                  multiline
                />
              )}
              {consulta.exame_fisico && (
                <InfoBlock
                  label="Exame Físico"
                  value={consulta.exame_fisico}
                  multiline
                />
              )}
              {consulta.procedimentos && (
                <InfoBlock
                  label="Procedimentos"
                  value={consulta.procedimentos}
                />
              )}
              {consulta.anamnese && (
                <InfoBlock
                  label="Anamnese"
                  value={consulta.anamnese}
                  multiline
                />
              )}
              {consulta.diagnostico && (
                <InfoBlock
                  label="Diagnóstico"
                  value={
                    consulta.cid
                      ? `${consulta.diagnostico} (CID: ${consulta.cid})`
                      : consulta.diagnostico
                  }
                />
              )}
              {consulta.conduta && (
                <InfoBlock
                  label="Conduta"
                  value={consulta.conduta}
                  multiline
                />
              )}
              {consulta.medicamentos_prescrevidos && (
                <InfoBlock
                  label="Medicamentos Prescritos"
                  value={consulta.medicamentos_prescrevidos}
                  multiline
                />
              )}
              {consulta.observacoes_internas && (
                <InfoBlock
                  label="Observações Internas"
                  value={consulta.observacoes_internas}
                  multiline
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InfoBlock({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p
        className={`text-secondary-800 ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}