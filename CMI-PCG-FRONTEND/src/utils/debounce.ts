/**
 * Debounce utility
 *
 * Delays function execution until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 */

interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}


/**
 * Throttle utility
 *
 * Only invokes func at most once per every wait milliseconds.
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();

    if (now - lastTime >= wait) {
      lastTime = now;
      func(...args);
    } else if (timeoutId === null) {
      timeoutId = setTimeout(() => {
        lastTime = Date.now();
        func(...args);
        timeoutId = null;
      }, wait - (now - lastTime));
    }
  };
}


export default debounce;