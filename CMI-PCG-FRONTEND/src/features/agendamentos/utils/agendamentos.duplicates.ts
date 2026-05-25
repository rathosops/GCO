import type { Agendamento } from '@/types';
import type { DuplicatesInfo } from '../types';
import { normalizeDigits, normalizeHora, normalizeText } from './agendamentos.helpers';

export function computeDuplicates(list: Agendamento[], diaISO: string): DuplicatesInfo {
  const map: Record<string, number[]> = {};

  for (const a of list) {
    const hora = normalizeHora(a.hora);
    const nome = normalizeText(a.nome_paciente);
    const protocolo = normalizeDigits((a as any).numero_de_protocolo ?? a.numero_de_protocolo);

    const cpf = normalizeDigits((a as any).cpf_paciente ?? a.cpf_paciente);
    const proc = normalizeText(a.procedimento);

    let key = `${diaISO}|${hora}|${nome}|${protocolo}`;
    if (!protocolo) key = `${diaISO}|${hora}|${nome}|${cpf}|${proc}|${protocolo}`;

    if (!map[key]) map[key] = [];
    if (a.id) map[key].push(a.id);
  }

  const byKey: Record<string, number[]> = {};
  let groups = 0;
  let extras = 0;

  for (const [k, ids] of Object.entries(map)) {
    const uniqueIds = Array.from(new Set(ids)).sort((x, y) => x - y);
    if (uniqueIds.length >= 2) {
      byKey[k] = uniqueIds;
      groups += 1;
      extras += uniqueIds.length - 1;
    }
  }

  return { groups, extras, byKey };
}
