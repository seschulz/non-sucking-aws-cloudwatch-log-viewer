import { useState, useEffect } from "react";
import { useLogStore, type TimeRange } from "../../stores/logStore";

const PRESETS = [
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
  { label: "3d", value: "3d" },
  { label: "7d", value: "7d" },
];

export default function TimeRangePicker() {
  const timeRange = useLogStore((s) => s.timeRange);
  const setTimeRange = useLogStore((s) => s.setTimeRange);

  const [selectValue, setSelectValue] = useState(
    timeRange.type === "relative" ? timeRange.value : "custom",
  );
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Sync internal state when store timeRange changes externally (e.g. histogram zoom)
  useEffect(() => {
    if (timeRange.type === "absolute") {
      setSelectValue("custom");
      // Format as datetime-local (YYYY-MM-DDThh:mm)
      const fmt = (ms: number) => {
        const d = new Date(ms);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      setCustomStart(fmt(timeRange.start));
      setCustomEnd(fmt(timeRange.end));
    } else if (timeRange.type === "relative") {
      setSelectValue(timeRange.value);
    }
  }, [timeRange]);

  const showCustom = selectValue === "custom";

  const handleChange = (value: string) => {
    setSelectValue(value);
    if (value !== "custom") {
      setTimeRange({ type: "relative", value });
    }
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      const start = new Date(customStart).getTime();
      const end = new Date(customEnd).getTime();
      if (!isNaN(start) && !isNaN(end) && start < end) {
        setTimeRange({ type: "absolute", start, end });
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectValue}
        onChange={(e) => handleChange(e.target.value)}
        className="select select-sm border border-base-content/20 bg-base-100 w-28"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            Last {p.label}
          </option>
        ))}
        <option value="custom">Custom</option>
      </select>

      {showCustom && (
        <div className="flex items-center gap-1.5">
          <input
            type="datetime-local"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="input input-sm border border-base-content/20 bg-base-100"
          />
          <span className="text-sm text-base-content/50">to</span>
          <input
            type="datetime-local"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="input input-sm border border-base-content/20 bg-base-100"
          />
          <button
            type="button"
            onClick={handleApplyCustom}
            className="btn btn-primary btn-sm"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
