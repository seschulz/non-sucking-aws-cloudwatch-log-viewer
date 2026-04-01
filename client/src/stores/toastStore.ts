import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  type: "error" | "info" | "success" | "warning";
}

let nextId = 0;

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"], durationMs?: number) => number;
  removeToast: (id: number) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = "error", durationMs = 5000) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, durationMs);
    return id;
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
