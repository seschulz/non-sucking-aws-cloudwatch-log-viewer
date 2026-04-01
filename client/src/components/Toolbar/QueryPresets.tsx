import { useEffect, useState } from "react";
import { useLogStore } from "../../stores/logStore";

interface Preset {
  label: string;
  pattern: string;
}

export default function QueryPresets() {
  const setFilterPattern = useLogStore((s) => s.setFilterPattern);
  const [presets, setPresets] = useState<Preset[]>([]);

  useEffect(() => {
    fetch("/api/query-presets")
      .then((r) => r.json())
      .then((data) => setPresets(data.presets ?? []))
      .catch(() => {});
  }, []);

  if (!presets.length) return null;

  return (
    <div className="dropdown">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-sm border border-base-content/20">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
        Presets
      </div>
      <ul tabIndex={0} className="dropdown-content menu bg-base-200 rounded-box z-50 w-max p-2 shadow-lg border border-base-300">
        {presets.map((p) => (
          <li key={p.label}>
            <button
              type="button"
              onClick={(e) => {
                setFilterPattern(p.pattern);
                (e.currentTarget.closest(".dropdown") as HTMLElement)?.blur();
                document.activeElement instanceof HTMLElement && document.activeElement.blur();
              }}
              className="text-xs whitespace-nowrap"
            >
              {p.label}
              <span className="ml-auto opacity-50 text-[10px]">{p.pattern}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
