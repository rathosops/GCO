export const tenantConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Clinica",
  description:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ??
    "Sistema de atendimento ocupacional",
  storagePrefix: process.env.NEXT_PUBLIC_STORAGE_PREFIX ?? "gco",
};

export function storageKey(name: string): string {
  return `${tenantConfig.storagePrefix}.${name}`;
}
