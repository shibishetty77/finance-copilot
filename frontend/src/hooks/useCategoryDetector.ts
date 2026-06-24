/**
 * useCategoryDetector — React hook that watches a description string,
 * runs the keyword rule engine, and returns a suggested CategoryMeta.
 * Debounced at 150 ms so it doesn't fire on every keypress.
 */
import { useState, useEffect, useRef } from 'react';
import { detectCategory, type CategoryMeta } from '@/utils/categorize';

export function useCategoryDetector(description: string): CategoryMeta | undefined {
  const [detected, setDetected] = useState<CategoryMeta | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDetected(detectCategory(description));
    }, 150);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [description]);

  return detected;
}
