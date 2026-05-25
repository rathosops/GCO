export function initialFrom(value?: string | null, fallback: string = "U") {
  const safe = (value ?? "").toString().trim();

  if (!safe) return fallback;

  // remove espaços duplicados
  const parts = safe.split(/\s+/).filter(Boolean);

  // 1 nome só: pega 2 letras
  if (parts.length === 1) {
    const word = parts[0]!;
    const a = word.charAt(0) || fallback;
    const b = word.charAt(1) || "";
    return (a + b).toUpperCase();
  }

  // 2+ nomes: pega primeira letra do primeiro e do último
  const first = parts[0]!.charAt(0) || fallback;
  const last = parts[parts.length - 1]!.charAt(0) || "";
  return (first + last).toUpperCase();
}


export function initialsFromFullName(value: unknown, fallback = "U"): string {
  const s = String(value ?? "").trim();
  if (!s) return fallback.toUpperCase();

  const parts = s.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0];
  const second = parts[1]?.[0];
  return String((second || first || fallback)).toUpperCase();
}
