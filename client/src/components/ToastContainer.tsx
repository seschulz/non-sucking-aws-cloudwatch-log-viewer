import { useToastStore } from "../stores/toastStore";

const ALERT_CLASS: Record<string, string> = {
  error: "alert-error",
  info: "alert-info",
  success: "alert-success",
  warning: "alert-warning",
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toast toast-end toast-bottom z-[100]">
      {toasts.map((t) => (
        <div key={t.id} role="alert" className={`alert ${ALERT_CLASS[t.type]} shadow-lg max-w-sm`}>
          <span className="text-sm">{t.message}</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square"
            onClick={() => removeToast(t.id)}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
