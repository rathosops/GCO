// src/components/feedback/toast.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  durationMs?: number;
}

interface ToastContextValue {
  show: (toast: Omit<ToastItem, 'id'>) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Classes semânticas usando CSS vars do tema.
 * No dark mode, success-light/danger-light/warning-light são
 * rgba() escuros (definidos no index.css), então ficam harmoniosos.
 */
function variantClasses(variant: ToastVariant): string {
  switch (variant) {
    case 'success':
      return 'border-semantic-success bg-success-light text-success';
    case 'error':
      return 'border-semantic-danger bg-danger-light text-danger';
    case 'warning':
      return 'border-semantic-warning bg-warning-light text-warning';
    default:
      return 'border-bg-300 bg-bg-100 text-text-100';
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timerId = timersRef.current[id];
    if (timerId) {
      window.clearTimeout(timerId);
      delete timersRef.current[id];
    }
  }, []);

  const show = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = uid();
      const durationMs = toast.durationMs ?? 4500;
      setToasts((prev) => [{ id, ...toast }, ...prev].slice(0, 4));
      timersRef.current[id] = window.setTimeout(() => remove(id), durationMs);
    },
    [remove]
  );

  const api = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message, title) => show({ message, title, variant: 'success' }),
      error: (message, title) => show({ message, title, variant: 'error' }),
      info: (message, title) => show({ message, title, variant: 'info' }),
      warning: (message, title) => show({ message, title, variant: 'warning' }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-[min(420px,calc(100vw-2rem))]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`card border ${variantClasses(t.variant)}`}
            role="status"
            aria-live="polite"
            style={{ boxShadow: 'var(--shadow-md)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {t.title ? <p className="font-bold">{t.title}</p> : null}
                <p className="text-sm break-words">{t.message}</p>
              </div>
              <button
                type="button"
                className="btn-ghost px-3 py-1 text-xs shrink-0"
                onClick={() => remove(t.id)}
              >
                Fechar
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}