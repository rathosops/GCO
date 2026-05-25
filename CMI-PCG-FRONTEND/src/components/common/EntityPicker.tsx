import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { debounce } from '@/utils/debounce';

type EntityPickerProps<T> = {
  title: string;
  placeholder: string;
  valueLabel?: string;
  selected?: T | null;
  onSelect: (item: T) => void;
  onClear?: () => void;
  load: (q: string) => Promise<T[]>;
  renderItem: (item: T) => { title: string; subtitle?: string; right?: string };
  minChars?: number;
};

export default function EntityPicker<T>({
  title,
  placeholder,
  selected,
  onSelect,
  onClear,
  load,
  renderItem,
  minChars = 0,
}: EntityPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedSetQ = useMemo(
    () =>
      debounce((v: string) => {
        setQ(v.trim());
      }, 350),
    []
  );

  useEffect(() => {
    debouncedSetQ(qInput);
  }, [qInput, debouncedSetQ]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      const hasMin = (q || '').length >= minChars;
      if (!open) return;

      if (!hasMin) {
        setItems([]);
        return;
      }

      try {
        setLoading(true);
        const data = await load(q);
        if (!alive) return;
        setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!alive) return;
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [open, q, minChars, load]);

  const clear = () => {
    setQInput('');
    setQ('');
    setItems([]);
    onClear?.();
  };

  const selectedRender = selected ? renderItem(selected) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-secondary-900">{title}</p>

        {selected ? (
          <button type="button" className="btn-ghost text-sm" onClick={clear}>
            <X className="h-4 w-4" />
            Limpar
          </button>
        ) : null}
      </div>

      {/* Selected pill */}
      {selected && selectedRender ? (
        <div className="p-3 rounded-2xl border border-secondary-200 bg-secondary-50 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-secondary-900 truncate">
              {selectedRender.title}
            </p>
            {selectedRender.subtitle ? (
              <p className="text-xs text-secondary-600 truncate">{selectedRender.subtitle}</p>
            ) : null}
          </div>
          <button type="button" className="btn-secondary shrink-0" onClick={() => setOpen(true)}>
            Trocar
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn-secondary w-full justify-start"
          onClick={() => setOpen(true)}
        >
          <Search className="h-4 w-4" />
          Selecionar
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="card p-3 border border-secondary-200 bg-bg-100">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-secondary-400" />
            <input
              className="input flex-1"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
            <button type="button" className="btn-icon btn-ghost" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 text-primary-600 animate-spin" />
            </div>
          ) : items.length ? (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {items.map((it, idx) => {
                const r = renderItem(it);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSelect(it);
                      setOpen(false);
                    }}
                    className="w-full text-left p-3 rounded-2xl border border-secondary-200 hover:bg-secondary-50 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-secondary-900 truncate">{r.title}</p>
                        {r.subtitle ? (
                          <p className="text-xs text-secondary-600 truncate">{r.subtitle}</p>
                        ) : null}
                      </div>
                      {r.right ? (
                        <p className="text-xs text-secondary-600 whitespace-nowrap">{r.right}</p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-secondary-500 py-4">
              {minChars > 0 && (q || '').length < minChars
                ? `Digite pelo menos ${minChars} caracteres para buscar.`
                : 'Nenhum resultado.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
