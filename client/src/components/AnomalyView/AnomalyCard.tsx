import type { Anomaly } from "../../stores/logStore";

interface AnomalyCardProps {
  anomaly: Anomaly;
  isSelected: boolean;
  onClick: () => void;
}

const SEVERITY_STYLES = {
  critical: {
    badge: "bg-error text-error-content",
    border: "border-l-error",
    label: "CRIT",
  },
  warning: {
    badge: "bg-warning text-warning-content",
    border: "border-l-warning",
    label: "WARN",
  },
  info: {
    badge: "bg-info text-info-content",
    border: "border-l-info",
    label: "INFO",
  },
};

export default function AnomalyCard({ anomaly, isSelected, onClick }: AnomalyCardProps) {
  const style = SEVERITY_STYLES[anomaly.severity];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-l-4 transition-colors ${style.border} ${
        isSelected ? "bg-base-300/70" : "hover:bg-base-300/40"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`${style.badge} px-1.5 py-0.5 rounded text-[9px] font-bold`}>
          {style.label}
        </span>
        <span className="text-sm font-medium text-base-content truncate">{anomaly.title}</span>
      </div>
      <div className="text-[11px] text-base-content/40">
        {anomaly.eventIds.length} event{anomaly.eventIds.length !== 1 ? "s" : ""}
      </div>
    </button>
  );
}
