import { useLogStore } from "../../stores/logStore";

export default function ColumnChips() {
  const pinnedColumns = useLogStore((s) => s.pinnedColumns);
  const removeColumn = useLogStore((s) => s.removeColumn);

  if (pinnedColumns.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-base-300 bg-base-200/50 px-4 py-2">
      <span className="text-xs font-medium text-base-content/50">
        Columns:
      </span>
      {pinnedColumns.map((col) => (
        <span
          key={col}
          className="badge badge-primary badge-outline badge-sm gap-1"
        >
          {col}
          <button
            type="button"
            onClick={() => removeColumn(col)}
            aria-label={`Remove column ${col}`}
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
    </div>
  );
}
