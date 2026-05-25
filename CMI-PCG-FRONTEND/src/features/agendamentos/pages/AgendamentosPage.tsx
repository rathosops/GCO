import { useMemo, useState } from "react";
import { addDays, format, isToday, isTomorrow, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Agendamento } from "@/types";
import type { AutocompletePaciente } from "@/services/autocomplete.api";
import { extractApiErrorMessage } from "../utils/agendamentos.helpers";
import { useAgendamentos } from "../hooks/useAgendamentos";
import { useAgendamentoForm } from "../hooks/useAgendamentoForm";
import { useAgendamentosDuplicates } from "../hooks/useAgendamentosDuplicates";
import { useAgendamentosImport } from "../hooks/useAgendamentosImport";
import { useDateAvailability } from "../hooks/useDateAvailability";

import {
  AgendamentoModal,
  AgendamentosDateNav,
  AgendamentosHeader,
  AgendamentosList,
  ImportCsvModal,
} from "../components";
import { PacientePickerModal } from "../components/PacientePickerModal";

export default function AgendamentosPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [showPacientePicker, setShowPacientePicker] = useState(false);

  const ag = useAgendamentos(selectedDate);
  const form = useAgendamentoForm({ agendamentos: ag.agendamentos });

  // Hook de verificação de feriados
  const dateAvailability = useDateAvailability(selectedDate);

  const dupes = useAgendamentosDuplicates({
    agendamentos: ag.agendamentos,
    diaISO: ag.diaISO,
    reload: ag.loadAgendamentos,
  });

  const imp = useAgendamentosImport({
    diaISO: ag.diaISO,
    currentList: ag.agendamentos,
    reload: ag.loadAgendamentos,
  });

  const handlePrevDay = () => setSelectedDate((prev) => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate((prev) => addDays(prev, 1));
  const handleToday = () => setSelectedDate(new Date());

  const getDateLabel = () => {
    if (isToday(selectedDate)) return "Hoje";
    if (isTomorrow(selectedDate)) return "Amanhã";
    return format(selectedDate, "EEEE", { locale: ptBR });
  };

  const formattedDate = useMemo(() => {
    return format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR });
  }, [selectedDate]);

  const filteredAgendamentos = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return ag.agendamentos;

    return ag.agendamentos.filter((a) => {
      const nome = (a.nome_paciente || "").toLowerCase();
      const proc = (a.procedimento || "").toLowerCase();
      const hora = (a.hora || "").toLowerCase();
      return nome.includes(t) || proc.includes(t) || hora.includes(t);
    });
  }, [ag.agendamentos, searchTerm]);

  const handleDelete = async (agendamento: Agendamento) => {
    if (!agendamento.id) return;

    const ok = window.confirm(
      `Excluir o agendamento de "${agendamento.nome_paciente || "Paciente"}" às ${format(
        new Date(`1970-01-01T${String(agendamento.hora).slice(0, 5)}`),
        "HH:mm",
      )}?`,
    );
    if (!ok) return;

    await ag.deleteAgendamento(agendamento.id);
  };

  const handleSelectPaciente = (paciente: AutocompletePaciente) => {
    setShowPacientePicker(false);
    form.openCreateModalWithPaciente({
      nome: paciente.nome,
      cpf: paciente.cpf,
      telefone: null,
    });
  };

  // Função para abrir modal de criação com verificação de feriado
  const handleOpenCreate = () => {
    if (!dateAvailability.disponivel) {
      const confirmMsg = dateAvailability.isFeriado
        ? `A data selecionada é feriado (${dateAvailability.feriadoNome}). Deseja criar um agendamento mesmo assim?`
        : dateAvailability.isFimDeSemana
          ? "A data selecionada é fim de semana. Deseja criar um agendamento mesmo assim?"
          : `A data selecionada está bloqueada: ${dateAvailability.motivo}. Deseja continuar?`;

      if (!window.confirm(confirmMsg)) {
        return;
      }
    }
    form.openCreateModal();
  };

  // Função para abrir picker de paciente com verificação de feriado
  const handleOpenPacientePicker = () => {
    if (!dateAvailability.disponivel) {
      const confirmMsg = dateAvailability.isFeriado
        ? `A data selecionada é feriado (${dateAvailability.feriadoNome}). Deseja criar um agendamento mesmo assim?`
        : dateAvailability.isFimDeSemana
          ? "A data selecionada é fim de semana. Deseja criar um agendamento mesmo assim?"
          : `A data selecionada está bloqueada: ${dateAvailability.motivo}. Deseja continuar?`;

      if (!window.confirm(confirmMsg)) {
        return;
      }
    }
    setShowPacientePicker(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.setFormError("");

    const err = form.validateForm();
    if (err) {
      form.setFormError(err);
      form.setTouched({ nome_paciente: true, hora: true });
      return;
    }

    const dia = ag.diaISO;

    try {
      if (form.editingAgendamento?.id) {
        await ag.updateAgendamento(form.editingAgendamento.id, {
          nome_paciente: form.formData.nome_paciente,
          cpf_paciente: form.formData.cpf_paciente,
          numero_de_contato: form.formData.numero_de_contato,
          numero_de_protocolo: form.formData.numero_de_protocolo,
          procedimento: form.formData.procedimento,
          hora: form.horaNormalizada,
          observacoes: form.formData.observacoes,
        });

        form.closeModal();
      } else {
        await ag.createAgendamento({
          nome_paciente: form.formData.nome_paciente,
          cpf_paciente: form.formData.cpf_paciente,
          numero_de_contato: form.formData.numero_de_contato,
          numero_de_protocolo: form.formData.numero_de_protocolo,
          procedimento: form.formData.procedimento,
          hora: form.horaNormalizada,
          observacoes: form.formData.observacoes,
          dia,
          status: "AGENDADO",
          paciente_compareceu: null,
        });

        form.closeModal();
      }
    } catch (error) {
      console.error("Erro ao salvar agendamento:", error);
      const msg = extractApiErrorMessage(error);
      form.setFormError(msg);
      // Não precisa alert aqui, já mostra no modal
    }
  };

  return (
    <div className="space-y-6">
      <AgendamentosHeader
        duplicatesInfo={dupes.duplicatesInfo}
        loading={ag.loading}
        cleaningDupes={dupes.cleaningDupes}
        onCleanDuplicates={dupes.limparDuplicados}
        onOpenImport={imp.openImportModal}
        onOpenCreate={handleOpenCreate}
        onOpenPacientePicker={handleOpenPacientePicker}
      />

      <AgendamentosDateNav
        dateLabel={getDateLabel()}
        formattedDate={formattedDate}
        isTodaySelected={isToday(selectedDate)}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        onToday={handleToday}
        dateAvailability={dateAvailability}
      />

      <AgendamentosList
        loading={ag.loading}
        items={filteredAgendamentos}
        updatingId={ag.updatingId}
        onEdit={form.openEditModal}
        onDelete={handleDelete}
        onCompareceu={(a) => ag.setComparecimento(a, true)}
        onFaltou={(a) => ag.setComparecimento(a, false)}
        onLimpar={(a) => ag.setComparecimento(a, null)}
      />

      <ImportCsvModal
        isOpen={imp.showImportModal}
        importing={imp.importing}
        dragActive={imp.dragActive}
        importFile={imp.importFile}
        importResult={imp.importResult}
        duplicatesInfo={dupes.duplicatesInfo}
        cleaningDupes={dupes.cleaningDupes}
        fileInputRef={imp.fileInputRef}
        onClose={imp.closeImportModal}
        onPickFile={imp.pickFile}
        onAcceptFile={imp.acceptFile}
        onDragOver={imp.onDragOver}
        onDragLeave={imp.onDragLeave}
        onDrop={imp.onDrop}
        onRunImport={imp.runImport}
        onClearFile={() => imp.setImportFile(null)}
        onCleanDupesNow={() => {
          imp.closeImportModal();
          dupes.limparDuplicados();
        }}
      />

      <AgendamentoModal
        isOpen={form.showModal}
        title={
          form.editingAgendamento ? "Editar Agendamento" : "Novo Agendamento"
        }
        hasConflict={form.hasConflict}
        horaNormalizada={form.horaNormalizada}
        saving={ag.saving}
        formData={form.formData}
        fieldErrors={form.fieldErrors}
        formError={form.formError}
        onClose={form.closeModal}
        onChange={form.setFormData}
        onTouched={(patch) => form.setTouched((t) => ({ ...t, ...patch }))}
        onSubmit={handleSubmit}
      />

      <PacientePickerModal
        isOpen={showPacientePicker}
        onClose={() => setShowPacientePicker(false)}
        onSelect={handleSelectPaciente}
      />
    </div>
  );
}
