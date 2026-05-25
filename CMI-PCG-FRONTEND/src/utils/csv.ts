import { Paciente } from '@/types';

function escapeCsv(value: any) {
  const s = String(value ?? '');
  // escapa aspas
  const escaped = s.replace(/"/g, '""');
  // se tiver separador ou quebra de linha, envolve em aspas
  return /[,"\n;]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function pacientesToCsv(pacientes: Paciente[]) {
  const headers = [
    'ID',
    'Nome',
    'CPF',
    'Nascimento',
    'Idade',
    'Sexo',
    'Telefone',
    'Email',
    'Endereço',
    'Empresa',
    'Convênio',
  ];

  const rows = pacientes.map((p) => [
    p.id,
    p.nome,
    p.cpf,
    p.data_de_nascimento_br ?? p.data_de_nascimento ?? '',
    p.idade ?? '',
    p.sexo ?? '',
    p.numero_de_contato ?? '',
    p.email ?? '',
    p.endereco ?? '',
    p.empresa?.nome ?? '',
    p.convenio?.nome ?? '',
  ]);

  // usando ; costuma ser melhor no Excel pt-BR
  const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(';')).join('\n');
  return '\uFEFF' + csv; // BOM pro Excel abrir acento certo
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
