import { useCallback, useEffect, useState } from "react";

/**
 * Steps through `count` items every `interval` ms while `running`. Once the
 * visitor picks an item themselves the cycling stops for good: they are in
 * control from then on.
 */
export function useAutoCycle(count: number, interval: number, running: boolean) {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!running || !auto || count < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => window.clearInterval(id);
  }, [running, auto, count, interval]);

  const select = useCallback((i: number) => {
    setAuto(false);
    setIndex(i);
  }, []);

  return { index, auto, select };
}
