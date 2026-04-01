import { useState, useRef, useCallback } from "react";

interface UseResizableOptions {
  storageKey: string;
  defaultSize: number;
  min: number;
  max: number;
  direction: "horizontal" | "vertical";
}

function getInitialSize(storageKey: string, defaultSize: number, min: number, max: number): number {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const val = Number(stored);
      if (!Number.isNaN(val)) return Math.max(min, Math.min(max, val));
    }
  } catch {
    // ignore
  }
  return defaultSize;
}

export function useResizable({ storageKey, defaultSize, min, max, direction }: UseResizableOptions) {
  const [size, setSizeState] = useState(() => getInitialSize(storageKey, defaultSize, min, max));
  const sizeRef = useRef(size);

  const setSize = useCallback(
    (newSize: number) => {
      const clamped = Math.max(min, Math.min(max, newSize));
      sizeRef.current = clamped;
      setSizeState(clamped);
    },
    [min, max],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startPos = direction === "vertical" ? e.clientY : e.clientX;
      const startSize = sizeRef.current;

      const handleMouseMove = (me: MouseEvent) => {
        const currentPos = direction === "vertical" ? me.clientY : me.clientX;
        const delta = currentPos - startPos;
        setSize(startSize + delta);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        try {
          localStorage.setItem(storageKey, String(sizeRef.current));
        } catch {
          // ignore
        }
      };

      document.body.style.cursor = direction === "vertical" ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [direction, storageKey, setSize],
  );

  return { size, handleMouseDown };
}
