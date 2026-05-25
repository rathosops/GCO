// src/utils/formatters.ts

export function onlyDigits(v: string) {
  return (v ?? '').replace(/\D/g, '');
}

export function formatCpf(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  if (d.length <= 3) return p1;
  if (d.length <= 6) return `${p1}.${p2}`;
  if (d.length <= 9) return `${p1}.${p2}.${p3}`;
  return `${p1}.${p2}.${p3}-${p4}`;
}

export function formatCnpj(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 8);
  const p4 = d.slice(8, 12);
  const p5 = d.slice(12, 14);
  if (d.length <= 2) return p1;
  if (d.length <= 5) return `${p1}.${p2}`;
  if (d.length <= 8) return `${p1}.${p2}.${p3}`;
  if (d.length <= 12) return `${p1}.${p2}.${p3}/${p4}`;
  return `${p1}.${p2}.${p3}/${p4}-${p5}`;
}

// telefone BR simples: (11) 99999-9999 / (11) 9999-9999
export function formatPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);

  if (d.length <= 2) return ddd ? `(${ddd}` : '';
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

export function isValidCpf(v: string) {
  return onlyDigits(v).length === 11;
}

export function isValidCnpj(v: string) {
  return onlyDigits(v).length === 14;
}

export function formatCurrencyBRL(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  const safeValue = Number.isFinite(n) ? n : 0;

  return safeValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
