import { useMemo, useRef, useState, useCallback } from "react";

function stableStringify(obj: any): string {
  if (obj === null || obj === undefined) return String(obj);
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
    return String(obj);
  }
  if (Array.isArray(obj)) {
    return JSON.stringify(obj);
  }
  if (typeof obj === "object") {
    return JSON.stringify(obj, Object.keys(obj).sort());
  }
  return JSON.stringify(obj);
}

export function useDirtyState<T>(value: T, resetKey?: string | number) {
  const baselineRef = useRef(stableStringify(value));
  const [, force] = useState(0);

  // when resetKey changes (ex: orderId), reset baseline to current value
  useMemo(() => {
    if (resetKey !== undefined) {
      baselineRef.current = stableStringify(value);
      // no force here, memo call already inside render
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const current = useMemo(() => stableStringify(value), [value]);
  const isDirty = current !== baselineRef.current;

  const markClean = useCallback(() => {
    baselineRef.current = current;
    force((x) => x + 1);
  }, [current]);

  const resetToClean = useCallback(() => {
    baselineRef.current = stableStringify(value);
    force((x) => x + 1);
  }, [value]);

  return { isDirty, markClean, resetToClean };
}
