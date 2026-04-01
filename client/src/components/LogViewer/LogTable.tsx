import { useRef, useCallback, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLogStore } from "../../stores/logStore";
import ColumnChips from "./ColumnChips";
import LogRow from "./LogRow";
import OnboardingSteps from "./OnboardingSteps";

export interface ColDef {
  key: string;
  label: string;
  width: number;
  minWidth: number;
  flex?: boolean;
}

export default function LogTable() {
  const logEvents = useLogStore((s) => s.logEvents);
  const isLoading = useLogStore((s) => s.isLoading);
  const nextToken = useLogStore((s) => s.nextToken);

  const selectedLogGroups = useLogStore((s) => s.selectedLogGroups);
  const pinnedColumns = useLogStore((s) => s.pinnedColumns);
  const loadMore = useLogStore((s) => s.loadMore);
  const hasSearched = useLogStore((s) => s.hasSearched);

  const parentRef = useRef<HTMLDivElement>(null);
  const showGroup = selectedLogGroups.length > 1;
  const showMessage = pinnedColumns.length === 0;

  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  // Build visible columns
  const allCols: (ColDef & { show: boolean })[] = [
    { key: "__expand", label: "", width: 20, minWidth: 20, show: true },
    { key: "__time", label: "Time", width: 185, minWidth: 100, show: true },
    { key: "__level", label: "Level", width: 60, minWidth: 40, show: true },
    { key: "__group", label: "Group", width: 150, minWidth: 60, show: showGroup },
    ...pinnedColumns.map((col) => ({
      key: col,
      label: col,
      width: 160,
      minWidth: 60,
      show: true,
    })),
    { key: "__message", label: "Message", width: 400, minWidth: 100, show: showMessage, flex: true },
  ];

  const visibleCols: ColDef[] = allCols
    .filter((c) => c.show)
    .map((c) => ({ key: c.key, label: c.label, width: colWidths[c.key] ?? c.width, minWidth: c.minWidth, flex: c.flex }));

  // Mark the last column as flex
  if (visibleCols.length > 0) {
    const last = visibleCols[visibleCols.length - 1];
    last.flex = true;
  }

  // Drag resize
  const dragRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent, col: ColDef) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = col.width;
    const startX = e.clientX;
    const colKey = col.key;
    const minW = col.minWidth;
    dragRef.current = { colKey, startX, startWidth };

    const handleMouseMove = (me: MouseEvent) => {
      const delta = me.clientX - startX;
      const newWidth = Math.max(minW, startWidth + delta);
      setColWidths((prev) => ({ ...prev, [colKey]: newWidth }));
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const virtualizer = useVirtualizer({
    count: logEvents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 32, []),
    overscan: 20,
  });

  // Sum of all column widths (including resized) + padding — this is the minimum scrollable width
  const totalColWidth = visibleCols.reduce((sum, col) => sum + col.width, 0) + 24;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ColumnChips />

      <div ref={parentRef} className="flex-1 overflow-auto">
        {/* Column header — sticky top, stretches to at least totalColWidth */}
        <div
          className="sticky top-0 z-10 flex items-center border-b border-base-300 bg-base-300/60 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-base-content/70 shadow-sm"
          style={{ minWidth: totalColWidth }}
        >
          {visibleCols.map((col, idx) => {
            const isLast = idx === visibleCols.length - 1;
            return (
              <div
                key={col.key}
                className="group relative shrink-0 truncate select-none"
                style={col.flex && isLast ? { flex: 1, minWidth: col.minWidth } : { width: col.width }}
              >
                <span className="truncate">{col.label}</span>
                {!isLast && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-[7px] cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onMouseDown={(e) => handleMouseDown(e, col)}
                  >
                    <div className="mx-auto h-full w-[1px] bg-primary/60" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Log rows */}
        {isLoading && logEvents.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <span className="loading loading-spinner loading-sm" />
            <span className="ml-2 text-sm text-base-content/40">Updating...</span>
          </div>
        ) : logEvents.length === 0 && !hasSearched ? (
          <OnboardingSteps />
        ) : logEvents.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-2 text-center">
              <svg className="h-12 w-12 text-base-content/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm text-base-content/50">
                No logs found
              </span>
              <span className="text-xs text-base-content/40">
                Try adjusting your filter pattern or time range
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              minWidth: totalColWidth,
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <LogRow
                  event={logEvents[virtualRow.index]}
                  showGroup={showGroup}
                  showMessage={showMessage}
                  columns={visibleCols}
                />
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {nextToken && !isLoading && logEvents.length > 0 && (
          <div className="flex justify-center border-t border-base-300 bg-base-200/40 py-3">
            <button
              type="button"
              onClick={() => loadMore()}
              className="btn btn-outline btn-accent btn-sm"
            >
              Load more results
            </button>
          </div>
        )}

        {isLoading && logEvents.length > 0 && (
          <div className="flex justify-center py-3">
            <span className="loading loading-spinner loading-sm" />
          </div>
        )}
      </div>

    </div>
  );
}
