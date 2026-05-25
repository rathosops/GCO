/**
 * Página Principal de Pacientes
 *
 * Lista com filtros, modais e aba de relatórios.
 * Sem header próprio — DashboardLayout já fornece.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  BarChart3,
  Loader2,
  AlertCircle,
  RefreshCw,
  Grid3X3,
  List,
  Stethoscope,
} from "lucide-react";

import type {
  Paciente,
  PacienteFormMode,
  ConsultasPorMes,
  PacientesPorEmpresa,
  PacientesPorConvenio,
} from "../types";

import {
  usePacientes,
  usePacientesStats,
  usePaciente,
  usePacienteFrequencia,
  useProntuario,
  usePacienteMutations,
  usePacientePdfDownload,
  useRelatorioResumo,
  useRelatorioFidelidade,
  useAniversariantes,
  usePacientesInativos,
} from "../hooks";
import { pacientesApi } from "../api";

import {
  PacienteCard,
  PacienteListItem,
  PacienteFiltersBar,
  PacienteFormModal,
  PacienteFichaModal,
  PacienteProntuarioModal,
  ResumoCard,
  ConsultasPorMesChart,
  FidelidadeDistribution,
  TopPacientesTable,
  AniversariantesCard,
  InativosTable,
  RankingBarChart,
} from "../components";

import { useToast } from "@/components/feedback/toast";

type TabType = "lista" | "relatorios";
type ViewMode = "grid" | "list";

export function PacientesPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<TabType>("lista");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Modais
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<PacienteFormMode>("create");
  const [fichaModalOpen, setFichaModalOpen] = useState(false);
  const [prontuarioModalOpen, setProntuarioModalOpen] = useState(false);
  const [selectedPacienteId, setSelectedPacienteId] = useState<number | null>(
    null,
  );

  // Data hooks
  const {
    pacientes,
    loading: loadingPacientes,
    error: errorPacientes,
    filters,
    hasMore,
    reload: reloadPacientes,
    updateFilters,
    clearFilters,
    nextPage,
    prevPage,
    page,
  } = usePacientes({ initialFilters: { limit: 12, include_frequency: true } });

  const { stats } = usePacientesStats();
  const { paciente: selectedPaciente } = usePaciente(selectedPacienteId);
  const { frequencia: selectedFrequencia } =
    usePacienteFrequencia(selectedPacienteId);
  const { prontuario, loading: loadingProntuario } = useProntuario(
    prontuarioModalOpen && selectedPaciente ? selectedPaciente.cpf : null,
  );
  const { create, update, remove, saving } = usePacienteMutations();
  const { downloadFicha, downloadProntuario, downloading } =
    usePacientePdfDownload();

  // Relatórios
  const [periodoResumo, setPeriodoResumo] = useState("30dias");
  const {
    resumo,
    loading: loadingResumo,
    reload: reloadResumo,
  } = useRelatorioResumo(periodoResumo);
  const { fidelidade, loading: loadingFidelidade } = useRelatorioFidelidade();
  const { aniversariantes, loading: loadingAniversariantes } =
    useAniversariantes({ dias: 30 });
  const { inativos, loading: loadingInativos } = usePacientesInativos({
    dias: 180,
    limite: 20,
  });

  const [consultasPorMes, setConsultasPorMes] = useState<ConsultasPorMes[]>([]);
  const [loadingConsultasMes, setLoadingConsultasMes] = useState(false);
  const [porEmpresa, setPorEmpresa] = useState<PacientesPorEmpresa[]>([]);
  const [loadingEmpresa, setLoadingEmpresa] = useState(false);
  const [porConvenio, setPorConvenio] = useState<PacientesPorConvenio[]>([]);
  const [loadingConvenio, setLoadingConvenio] = useState(false);

  useEffect(() => {
    if (activeTab !== "relatorios") return;
    setLoadingConsultasMes(true);
    pacientesApi.relatorios
      .getConsultasPorMes(12)
      .then((res) => setConsultasPorMes(res.dados))
      .catch(console.error)
      .finally(() => setLoadingConsultasMes(false));

    setLoadingEmpresa(true);
    pacientesApi.relatorios
      .getPorEmpresa(10)
      .then((res) => setPorEmpresa(res.empresas))
      .catch(console.error)
      .finally(() => setLoadingEmpresa(false));

    setLoadingConvenio(true);
    pacientesApi.relatorios
      .getPorConvenio(10)
      .then((res) => setPorConvenio(res.convenios))
      .catch(console.error)
      .finally(() => setLoadingConvenio(false));
  }, [activeTab]);

  // ── Handlers ──
  const handleOpenCreate = () => {
    setFormMode("create");
    setSelectedPacienteId(null);
    setFormModalOpen(true);
  };
  const handleOpenEdit = (id: number) => {
    setSelectedPacienteId(id);
    setFormMode("edit");
    setFormModalOpen(true);
  };
  const handleOpenFicha = (id: number) => {
    setSelectedPacienteId(id);
    setFichaModalOpen(true);
  };
  const handleOpenProntuario = (id: number) => {
    setSelectedPacienteId(id);
    setProntuarioModalOpen(true);
  };

  const handleCloseModals = () => {
    setFormModalOpen(false);
    setFichaModalOpen(false);
    setProntuarioModalOpen(false);
    setTimeout(() => setSelectedPacienteId(null), 300);
  };

  const handleSubmitForm = async (data: Partial<Paciente>) => {
    try {
      if (formMode === "create") {
        await create(data);
        toast.success("Paciente cadastrado com sucesso!");
      } else if (selectedPacienteId) {
        await update(selectedPacienteId, data);
        toast.success("Paciente atualizado com sucesso!");
      }
      handleCloseModals();
      reloadPacientes();
    } catch (err) {
      toast.error((err as Error).message || "Erro ao salvar paciente");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este paciente?")) return;
    try {
      await remove(id);
      toast.success("Paciente excluído com sucesso!");
      reloadPacientes();
    } catch (err) {
      toast.error((err as Error).message || "Erro ao excluir paciente");
    }
  };

  const handleDownloadFicha = () => {
    if (selectedPacienteId && selectedPaciente)
      downloadFicha(selectedPacienteId, selectedPaciente.nome);
  };

  const handleDownloadProntuario = () => {
    if (selectedPacienteId && selectedPaciente)
      downloadProntuario(selectedPacienteId, selectedPaciente.nome);
  };

  const handlePeriodoChange = (p: string) => {
    setPeriodoResumo(p);
    reloadResumo(p);
  };

  const pacienteComFrequencia = selectedPaciente
    ? { ...selectedPaciente, frequencia: selectedFrequencia?.frequencia }
    : null;

  return (
    <div className="space-y-5 max-w-[1440px] mx-auto">
      {/* ═══ Top bar: stats + tabs + actions ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-300 rounded-xl">
            <Users className="h-5 w-5 text-primary-100" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-200">
              {stats?.total_pacientes ?? stats?.pacientes ?? 0} cadastrados
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-bg-200 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("lista")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "lista"
                  ? "bg-bg-100 text-primary-100 shadow-sm"
                  : "text-text-200 hover:text-text-100"
              }`}
            >
              <Users className="h-3.5 w-3.5 inline mr-1" />
              Lista
            </button>
            <button
              onClick={() => setActiveTab("relatorios")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "relatorios"
                  ? "bg-bg-100 text-primary-100 shadow-sm"
                  : "text-text-200 hover:text-text-100"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5 inline mr-1" />
              Relatórios
            </button>
          </div>

          {activeTab === "lista" && (
            <>
              {/* View toggle */}
              <div className="hidden md:flex items-center gap-1 bg-bg-200 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded ${viewMode === "grid" ? "bg-bg-100 shadow-sm" : ""}`}
                  title="Grade"
                >
                  <Grid3X3 className="h-4 w-4 text-text-200" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded ${viewMode === "list" ? "bg-bg-100 shadow-sm" : ""}`}
                  title="Lista"
                >
                  <List className="h-4 w-4 text-text-200" />
                </button>
              </div>

              <button
                onClick={reloadPacientes}
                className="btn-ghost"
                disabled={loadingPacientes}
                title="Recarregar"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loadingPacientes ? "animate-spin" : ""}`}
                />
              </button>
            </>
          )}

          <button onClick={handleOpenCreate} className="btn-primary">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Paciente</span>
          </button>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <AnimatePresence mode="wait">
        {activeTab === "lista" ? (
          <motion.div
            key="lista"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <PacienteFiltersBar
              filters={filters}
              onFiltersChange={updateFilters}
              onClear={clearFilters}
              resultCount={pacientes.length}
              loading={loadingPacientes}
            />

            {errorPacientes && (
              <div className="card flex items-center gap-3 border-semantic-danger bg-danger-light text-danger">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="flex-1 text-sm">{errorPacientes}</p>
                <button
                  onClick={reloadPacientes}
                  className="btn-secondary text-sm"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {loadingPacientes && pacientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary-100 mb-3" />
                <p className="text-text-200">Carregando pacientes...</p>
              </div>
            ) : pacientes.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16">
                <Users className="h-12 w-12 text-bg-300 mb-3" />
                <p className="text-text-200 mb-4">Nenhum paciente encontrado</p>
                <button onClick={handleOpenCreate} className="btn-primary">
                  <Plus className="h-4 w-4" /> Cadastrar Primeiro Paciente
                </button>
              </div>
            ) : viewMode === "grid" ? (
              /* Grid responsivo: 1 col mobile, 2 em HD, 3 em FHD */
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                {pacientes.map((p, i) => (
                  <PacienteCard
                    key={p.id}
                    paciente={p}
                    index={i}
                    onClick={() => handleOpenFicha(p.id)}
                    onEdit={() => handleOpenEdit(p.id)}
                    onDelete={() => handleDelete(p.id)}
                    onProntuario={() => handleOpenProntuario(p.id)}
                    onFicha={() => handleOpenFicha(p.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {pacientes.map((p) => (
                  <PacienteListItem
                    key={p.id}
                    paciente={p}
                    onClick={() => handleOpenFicha(p.id)}
                    onEdit={() => handleOpenEdit(p.id)}
                  />
                ))}
              </div>
            )}

            {pacientes.length > 0 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-text-200">Página {page}</p>
                <div className="flex gap-2">
                  <button
                    onClick={prevPage}
                    disabled={page === 1}
                    className="btn-secondary text-sm"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={nextPage}
                    disabled={!hasMore}
                    className="btn-secondary text-sm"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="relatorios"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <ResumoCard
              resumo={resumo}
              loading={loadingResumo}
              periodo={periodoResumo}
              onPeriodoChange={handlePeriodoChange}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ConsultasPorMesChart
                dados={consultasPorMes}
                loading={loadingConsultasMes}
              />
              <FidelidadeDistribution
                fidelidade={fidelidade}
                loading={loadingFidelidade}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <TopPacientesTable
                fidelidade={fidelidade}
                loading={loadingFidelidade}
                onPacienteClick={handleOpenFicha}
              />
              <AniversariantesCard
                aniversariantes={aniversariantes}
                loading={loadingAniversariantes}
                titulo="Aniversariantes (Próx. 30 dias)"
              />
              <InativosTable
                inativos={inativos}
                loading={loadingInativos}
                diasCorte={180}
                onPacienteClick={handleOpenFicha}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <RankingBarChart
                dados={porEmpresa}
                tipo="empresa"
                loading={loadingEmpresa}
              />
              <RankingBarChart
                dados={porConvenio}
                tipo="convenio"
                loading={loadingConvenio}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modais */}
      <PacienteFormModal
        isOpen={formModalOpen}
        onClose={handleCloseModals}
        onSubmit={handleSubmitForm}
        mode={formMode}
        initialData={selectedPaciente}
        saving={saving}
      />
      <PacienteFichaModal
        isOpen={fichaModalOpen}
        onClose={handleCloseModals}
        paciente={pacienteComFrequencia}
        onDownloadFicha={handleDownloadFicha}
        onProntuario={() => {
          setFichaModalOpen(false);
          setProntuarioModalOpen(true);
        }}
        downloadingFicha={downloading}
      />
      <PacienteProntuarioModal
        isOpen={prontuarioModalOpen}
        onClose={handleCloseModals}
        paciente={pacienteComFrequencia}
        prontuario={prontuario}
        loading={loadingProntuario}
        onDownload={handleDownloadProntuario}
        downloading={downloading}
      />
    </div>
  );
}

export default PacientesPage;
