import { useEffect, useState } from 'react';

export function useAnimatedNumber(target: number, duration = 700): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(target)) return;

    const start = performance.now();
    const from = value;
    let frame: number;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
