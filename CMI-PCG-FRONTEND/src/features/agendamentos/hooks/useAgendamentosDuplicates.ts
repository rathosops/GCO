import { useMemo, useState } from 'react';
import { computeDuplicates } from '../utils/agendamentos.duplicates';
import { agendamentosAPI } from '../api';
import type { Agendamento } from '@/types';

export function useAgendamentosDuplicates(opts: {
  agendamentos: Agendamento[];
  diaISO: string;
  reload: () => Promise<void>;
}) {
  const { agendamentos, diaISO, reload } = opts;
  const [cleaningDupes, setCleaningDupes] = useState(false);

  const duplicatesInfo = useMemo(() => computeDuplicates(agendamentos, diaISO), [agendamentos, diaISO]);

  const limparDuplicados = async () => {
    if (cleaningDupes) return;

    const extras = duplicatesInfo.extras;
    if (!extras) {
      alert('Nenhum duplicado encontrado para este dia.');
      return;
    }

    const ok = window.confirm(
      `Foram encontrados ${duplicatesInfo.groups} grupo(s) com duplicidade e ${extras} registro(s) duplicado(s) para remover.\n\nDeseja limpar agora?`
    );
    if (!ok) return;

    try {
      setCleaningDupes(true);

      const idsToDelete: number[] = [];
      for (const ids of Object.values(duplicatesInfo.byKey)) {
        const sorted = ids.slice().sort((a, b) => a - b);
        idsToDelete.push(...sorted.slice(1));
      }

      for (const id of idsToDelete) {
        try {
          await agendamentosAPI.delete(id);
        } catch (e) {
          console.error('Falha ao deletar duplicado id=', id, e);
        }
      }

      await reload();
      alert('Duplicados removidos com sucesso.');
    } finally {
      setCleaningDupes(false);
    }
  };

  return { duplicatesInfo, cleaningDupes, limparDuplicados };
}
