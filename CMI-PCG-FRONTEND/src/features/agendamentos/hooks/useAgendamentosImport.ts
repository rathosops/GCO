import { useRef, useState } from 'react';
import { agendamentosAPI } from '../api';
import { extractApiErrorMessage } from '../utils/agendamentos.helpers';
import { computeDuplicates } from '../utils/agendamentos.duplicates';
import type { ImportResult } from '../types';
import type { Agendamento } from '@/types';

export function useAgendamentosImport(opts: {
  diaISO: string;
  currentList: Agendamento[];
  reload: () => Promise<void>;
}) {
  const { diaISO, currentList, reload } = opts;

  const [showImportModal, setShowImportModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openImportModal = () => {
    setImportFile(null);
    setImportResult(null);
    setDragActive(false);
    setShowImportModal(true);
  };

  const closeImportModal = () => {
    if (importing) return;
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
    setDragActive(false);
  };

  const pickFile = () => fileInputRef.current?.click();

  const acceptFile = (file: File | null) => {
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.csv')) {
      alert('Selecione um arquivo .csv');
      return;
    }
    setImportFile(file);
    setImportResult(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    acceptFile(f);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const runImport = async () => {
    if (!importFile) {
      alert('Selecione um arquivo .csv para importar.');
      return;
    }

    try {
      setImporting(true);

      const beforeDupes = computeDuplicates(currentList, diaISO);

      const res = await agendamentosAPI.importCsv(importFile);
      setImportResult(res);

      await reload();

      const after = await agendamentosAPI.getByData(diaISO);
      const afterList = Array.isArray(after) ? after : [];
      const afterDupes = computeDuplicates(afterList, diaISO);

      if (afterDupes.extras > 0 && afterDupes.extras >= beforeDupes.extras) {
        alert(
          `Atenção: após importar, este dia ficou com ${afterDupes.groups} grupo(s) duplicados e ${afterDupes.extras} registro(s) duplicado(s).\n\nUse o botão "Limpar duplicados" no topo para corrigir.`
        );
      }
    } catch (e) {
      console.error('Erro ao importar CSV:', e);
      alert(extractApiErrorMessage(e));
    } finally {
      setImporting(false);
    }
  };

  return {
    // state
    showImportModal,
    dragActive,
    importing,
    importFile,
    importResult,
    fileInputRef,

    // actions
    openImportModal,
    closeImportModal,
    pickFile,
    acceptFile,
    onDrop,
    onDragOver,
    onDragLeave,
    runImport,
    setImportFile,
  };
}
