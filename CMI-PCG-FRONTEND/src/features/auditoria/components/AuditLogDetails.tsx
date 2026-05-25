/**
 * Detalhes de um log de auditoria — v2 com dados estruturados.
 *
 * Três modos de exibição baseados na ação:
 * - CREATE: grid de campos criados com labels em PT-BR
 * - UPDATE: diff visual old → new com labels
 * - DELETE: campos do registro excluído (estilo muted)
 *
 * Compatibilidade:
 * - Dados v2 (fields como array de {field, label, value}) → uso direto
 * - Dados v1 (data/deleted_data como dict plano) → normalizado pelo backend
 * - Safety: frontend também normaliza caso o backend antigo esteja ativo
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Braces, FileText, GitCompare, Trash2, ArrowRight } from "lucide-react";
import type { AuditLog, AuditField, AuditChange } from "../types";
import { ACTION_CONFIG } from "../types";

// =============================================================================
// Helpers
// =============================================================================

function prettyValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length ? v : "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function fieldLabel(key: string, label?: string): string {
  if (label) return label;
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Normaliza fields para array de AuditField.
 * Aceita: array (v2), dict plano (v1 fallback), ou null.
 */
function normalizeFields(raw: unknown): AuditField[] | null {
  if (!raw) return null;

  // v2: já é array
  if (Array.isArray(raw)) return raw as AuditField[];

  // v1 fallback: dict plano → converter
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => ({ field: k, label: fieldLabel(k), value: v }));
  }

  return null;
}

/**
 * Normaliza changes para Record<string, AuditChange>.
 * Aceita: dict com ou sem label.
 */
function normalizeChanges(raw: unknown): Record<string, AuditChange> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const result: Record<string, AuditChange> = {};
  for (const [key, change] of Object.entries(raw as Record<string, any>)) {
    if (!change || typeof change !== "object") continue;
    result[key] = {
      old: change.old,
      new: change.new,
      label: change.label || fieldLabel(key),
    };
  }
  return Object.keys(result).length ? result : null;
}

// =============================================================================
// Sub-componentes
// =============================================================================

function SummaryBanner({ log }: { log: AuditLog }) {
  const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
  const summary = log.summary;
  if (!summary) return null;

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg ${cfg.bg}`}
    >
      <span className="text-base">{cfg.icon}</span>
      <p className={`text-sm font-medium ${cfg.color}`}>{summary}</p>
    </div>
  );
}

function CreatedFieldsGrid({ fields }: { fields: AuditField[] }) {
  if (!fields.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-200 uppercase tracking-wider">
        Dados cadastrados
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-bg-200 rounded-lg overflow-hidden border border-bg-200">
        {fields.map((f, i) => (
          <motion.div
            key={f.field || i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.02 }}
            className="bg-bg-100 px-3 py-2.5"
          >
            <p className="text-[10px] font-medium text-text-200 uppercase tracking-wider">
              {fieldLabel(f.field, f.label)}
            </p>
            <p className="text-sm text-text-100 break-words mt-0.5">
              {prettyValue(f.value)}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ChangesDiff({ changes }: { changes: Record<string, AuditChange> }) {
  const entries = Object.entries(changes);
  if (!entries.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-200 uppercase tracking-wider">
        {entries.length}{" "}
        {entries.length === 1 ? "campo alterado" : "campos alterados"}
      </p>

      <div className="space-y-2">
        {entries.map(([key, change], idx) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04 }}
            className="rounded-lg border border-bg-200 overflow-hidden"
          >
            <div className="px-3 py-1.5 bg-bg-200/50 border-b border-bg-200">
              <p className="text-xs font-semibold text-text-100">
                {fieldLabel(key, change.label)}
              </p>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
              <div className="px-3 py-2.5 bg-red-50/50">
                <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">
                  Antes
                </p>
                <p className="text-xs text-red-700 break-words">
                  {prettyValue(change.old)}
                </p>
              </div>

              <div className="flex items-center px-2 bg-bg-100">
                <ArrowRight className="h-3.5 w-3.5 text-text-200/40" />
              </div>

              <div className="px-3 py-2.5 bg-emerald-50/50">
                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-1">
                  Depois
                </p>
                <p className="text-xs text-emerald-700 break-words">
                  {prettyValue(change.new)}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function DeletedFieldsGrid({ fields }: { fields: AuditField[] }) {
  if (!fields.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-200 uppercase tracking-wider">
        Dados do registro excluído
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-red-100/30 rounded-lg overflow-hidden border border-red-200/40">
        {fields.map((f, i) => (
          <motion.div
            key={f.field || i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.02 }}
            className="bg-bg-100 px-3 py-2.5"
          >
            <p className="text-[10px] font-medium text-text-200 uppercase tracking-wider">
              {fieldLabel(f.field, f.label)}
            </p>
            <p className="text-sm text-text-200 break-words mt-0.5 line-through decoration-red-300">
              {prettyValue(f.value)}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Componente principal
// =============================================================================

type ViewMode =
  | { kind: "create"; fields: AuditField[] }
  | { kind: "update"; changes: Record<string, AuditChange> }
  | { kind: "delete"; fields: AuditField[] }
  | { kind: "empty" };

export function AuditLogDetails({ log }: { log: AuditLog }) {
  const [tab, setTab] = useState<"resumo" | "json">("resumo");

  const view = useMemo((): ViewMode => {
    // ── CREATE ───────────────────────────────────────────────────────
    if (log.action === "create") {
      // v2: log.fields (normalizado pelo backend)
      // v1 fallback: details_raw.data ou details.data
      const raw =
        log.fields ||
        log.details_raw?.fields ||
        log.details_raw?.data ||
        log.details?.fields ||
        log.details?.data;

      const fields = normalizeFields(raw);
      if (fields?.length) return { kind: "create", fields };
    }

    // ── UPDATE ───────────────────────────────────────────────────────
    if (log.action === "update") {
      const raw =
        log.changes || log.details_raw?.changes || log.details?.changes;

      const changes = normalizeChanges(raw);
      if (changes) return { kind: "update", changes };
    }

    // ── DELETE ───────────────────────────────────────────────────────
    if (log.action === "delete") {
      const raw =
        log.deleted_fields ||
        log.fields ||
        log.details_raw?.deleted_fields ||
        log.details_raw?.deleted_data ||
        log.details?.deleted_fields ||
        log.details?.deleted_data;

      const fields = normalizeFields(raw);
      if (fields?.length) return { kind: "delete", fields };
    }

    return { kind: "empty" };
  }, [log]);

  const headerIcon = {
    create: <FileText className="h-4 w-4" />,
    update: <GitCompare className="h-4 w-4" />,
    delete: <Trash2 className="h-4 w-4" />,
    empty: <Braces className="h-4 w-4" />,
  }[view.kind];

  const headerTitle = {
    create: "Dados cadastrados",
    update: "O que mudou",
    delete: "Registro excluído",
    empty: "Detalhes",
  }[view.kind];

  const rawJson = log.details_raw || log.details || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 rounded-xl border border-bg-300 bg-bg-100 overflow-hidden"
    >
      {/* Header com tabs */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-bg-200">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-100">
          {headerIcon}
          {headerTitle}
        </div>

        <div className="flex items-center gap-1 bg-bg-200 rounded-lg p-0.5">
          {(["resumo", "json"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                tab === t
                  ? "bg-bg-100 text-text-100 shadow-sm"
                  : "text-text-200 hover:text-text-100"
              }`}
            >
              {t === "resumo" ? "Resumo" : "JSON"}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        <SummaryBanner log={log} />

        {tab === "resumo" && (
          <>
            {view.kind === "create" && (
              <CreatedFieldsGrid fields={view.fields} />
            )}
            {view.kind === "update" && <ChangesDiff changes={view.changes} />}
            {view.kind === "delete" && (
              <DeletedFieldsGrid fields={view.fields} />
            )}
            {view.kind === "empty" && (
              <p className="text-xs text-text-200 py-2">
                Nenhum detalhe disponível. Use a aba JSON para referência.
              </p>
            )}
          </>
        )}

        {tab === "json" && (
          <pre className="p-3 bg-bg-200 rounded-lg text-xs text-text-200 overflow-x-auto max-h-72 scrollbar-thin">
            {JSON.stringify(rawJson, null, 2)}
          </pre>
        )}
      </div>
    </motion.div>
  );
}
