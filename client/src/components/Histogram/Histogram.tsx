import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useLogStore, type HistogramBucket } from "../../stores/logStore";

const LEVEL_FILL_CLASS: Record<string, string> = {
  ERROR: "fill-error",
  WARN: "fill-warning",
  INFO: "fill-info",
  DEBUG: "fill-neutral",
  OTHER: "fill-neutral",
};

const LEVEL_BG_CLASS: Record<string, string> = {
  ERROR: "bg-error",
  WARN: "bg-warning",
  INFO: "bg-info",
  DEBUG: "bg-neutral/80",
  OTHER: "bg-neutral",
};

const LEVEL_FILL_OPACITY: Record<string, number> = {
  DEBUG: 0.2,
};

const STACK_ORDER = ["ERROR", "WARN", "INFO", "DEBUG", "OTHER"] as const;

const MARGIN = { top: 4, right: 8, bottom: 28, left: 40 };
const BAR_GAP = 1;

function formatTime(ms: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${date} ${time}`;
}

function formatBucketSize(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s >= 86400) return `${Math.round(s / 86400)}d`;
  if (s >= 3600) return `${Math.round(s / 3600)}h`;
  if (s >= 60) return `${Math.round(s / 60)}m`;
  return `${s}s`;
}

export default function Histogram({ height }: { height?: number }) {
  const buckets = useLogStore((s) => s.histogramData);
  const histogramError = useLogStore((s) => s.histogramError);
  const isLoading = useLogStore((s) => s.isHistogramLoading);
  const preZoomTimeRange = useLogStore((s) => s.preZoomTimeRange);
  const zoomToRange = useLogStore((s) => s.zoomToRange);
  const resetZoom = useLogStore((s) => s.resetZoom);
  const fetchHistogram = useLogStore((s) => s.fetchHistogram);
  const theme = useLogStore((s) => s.theme);

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  // Subtract space for header (~20px) and legend (~20px)
  const svgHeight = Math.max(40, (height ?? 140) - 40);

  // Responsive width — re-run when buckets arrive so ref is available
  const hasBuckets = !!buckets && buckets.length > 0;
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 800;
      setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasBuckets]);

  // Re-fetch histogram when width changes significantly
  const prevWidthRef = useRef(width);
  useEffect(() => {
    const diff = Math.abs(width - prevWidthRef.current);
    if (diff > 100) {
      prevWidthRef.current = width;
      fetchHistogram(width);
    }
  }, [width, fetchHistogram]);

  // Drag-select state
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    x: number;
    bucket: HistogramBucket;
  } | null>(null);

  // Precompute chart geometry (safe even when buckets is null — just defaults)
  const chartWidth = width - MARGIN.left - MARGIN.right;
  const chartHeight = svgHeight - MARGIN.top - MARGIN.bottom;
  const bucketCount = buckets?.length ?? 0;
  const barWidth = bucketCount > 0 ? Math.max(1, chartWidth / bucketCount - BAR_GAP) : 0;

  const bucketToX = useCallback(
    (i: number) => MARGIN.left + i * (barWidth + BAR_GAP),
    [barWidth],
  );

  const xToBucketIndex = useCallback(
    (px: number) => {
      if (bucketCount === 0) return 0;
      const idx = Math.floor((px - MARGIN.left) / (barWidth + BAR_GAP));
      return Math.max(0, Math.min(bucketCount - 1, idx));
    },
    [barWidth, bucketCount],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setDragStart(x);
    setDragEnd(x);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;

      if (dragStart !== null) {
        setDragEnd(x);
        setTooltip(null);
      } else {
        const idx = xToBucketIndex(x);
        if (buckets && idx >= 0 && idx < buckets.length) {
          setTooltip({ x: bucketToX(idx) + barWidth / 2, bucket: buckets[idx] });
        } else {
          setTooltip(null);
        }
      }
    },
    [dragStart, buckets, barWidth, xToBucketIndex, bucketToX],
  );

  const handleMouseUp = useCallback(() => {
    if (dragStart !== null && dragEnd !== null && buckets) {
      const startIdx = xToBucketIndex(Math.min(dragStart, dragEnd));
      const endIdx = xToBucketIndex(Math.max(dragStart, dragEnd));
      if (endIdx > startIdx) {
        zoomToRange(buckets[startIdx].start, buckets[endIdx].end);
      }
    }
    setDragStart(null);
    setDragEnd(null);
  }, [dragStart, dragEnd, buckets, zoomToRange, xToBucketIndex]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    if (dragStart !== null) {
      setDragStart(null);
      setDragEnd(null);
    }
  }, [dragStart]);

  // Computed values for rendering (memoized for the chart body)
  const { maxTotal, totalEvents, bucketSizeMs, yTicks, xLabelInterval, midnights } = useMemo(() => {
    if (!buckets || buckets.length === 0) {
      return { maxTotal: 1, totalEvents: 0, bucketSizeMs: 0, yTicks: [0, 0, 1], xLabelInterval: 1, midnights: [] };
    }
    const max = Math.max(
      1,
      ...buckets.map((b) =>
        STACK_ORDER.reduce((sum, level) => sum + (b.counts[level] || 0), 0),
      ),
    );
    const total = buckets.reduce(
      (sum, b) => sum + STACK_ORDER.reduce((s, l) => s + (b.counts[l] || 0), 0),
      0,
    );
    const size = buckets.length > 1 ? buckets[1].start - buckets[0].start : 0;

    // Find midnight boundaries within the time range
    const rangeStart = buckets[0].start;
    const rangeEnd = buckets[buckets.length - 1].end;
    const mids: number[] = [];
    const firstDay = new Date(rangeStart);
    firstDay.setHours(0, 0, 0, 0);
    let midnight = firstDay.getTime() + 24 * 60 * 60 * 1000; // first midnight after range start
    while (midnight < rangeEnd) {
      if (midnight > rangeStart) {
        mids.push(midnight);
      }
      midnight += 24 * 60 * 60 * 1000;
    }

    return {
      maxTotal: max,
      totalEvents: total,
      bucketSizeMs: size,
      yTicks: [0, Math.round(max / 2), max],
      xLabelInterval: Math.max(1, Math.floor(buckets.length / 6)),
      midnights: mids,
    };
  }, [buckets]);

  // Drag selection rect
  const selectionX = dragStart !== null && dragEnd !== null ? Math.min(dragStart, dragEnd) : 0;
  const selectionW = dragStart !== null && dragEnd !== null ? Math.abs(dragEnd - dragStart) : 0;

  const isDark = theme === "dark";

  // Early returns AFTER all hooks
  if (!buckets || buckets.length === 0) {
    if (isLoading) {
      return (
        <div className="border-b border-base-300 bg-base-200/50 px-3 py-6 flex items-center justify-center">
          <span className="loading loading-spinner loading-sm" />
          <span className="ml-2 text-sm text-base-content/40">Updating...</span>
        </div>
      );
    }
    if (histogramError) {
      return (
        <div className="border-b border-base-300 bg-base-200/50 px-3 py-2">
          <span className="text-xs text-error">Histogram: {histogramError}</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col bg-base-200/50 px-3 pt-1 pb-1 h-full overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold uppercase tracking-widest text-base-content/70">
          Log Distribution
        </span>
        <span className="text-[10px] text-base-content/50">
          {bucketSizeMs > 0 && <>{formatBucketSize(bucketSizeMs)} Buckets</>}
          {preZoomTimeRange && (
            <>
              {" "}&middot;{" "}
              <button
                type="button"
                onClick={resetZoom}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                Reset zoom
              </button>
            </>
          )}
        </span>
      </div>

      {/* SVG Chart */}
      <svg
        width={width}
        height={svgHeight}
        className="select-none"
        style={{ cursor: dragStart !== null ? "col-resize" : "crosshair" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid lines */}
        {yTicks.map((tick, i) => {
          const y = MARGIN.top + chartHeight - (tick / maxTotal) * chartHeight;
          return (
            <g key={i}>
              <line
                x1={MARGIN.left}
                y1={y}
                x2={width - MARGIN.right}
                y2={y}
                stroke={isDark ? "#333" : "#e5e5e5"}
                strokeWidth={tick === 0 ? 1 : 0.5}
              />
              <text
                x={MARGIN.left - 4}
                y={y + 3}
                textAnchor="end"
                fill={isDark ? "#737373" : "#a3a3a3"}
                fontSize={9}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Midnight lines */}
        {buckets && midnights.map((ms) => {
          const rangeStart = buckets[0].start;
          const rangeEnd = buckets[buckets.length - 1].end;
          const x = MARGIN.left + ((ms - rangeStart) / (rangeEnd - rangeStart)) * chartWidth;
          return (
            <line
              key={ms}
              x1={x}
              y1={MARGIN.top}
              x2={x}
              y2={MARGIN.top + chartHeight}
              stroke={isDark ? "#555" : "#bbb"}
              strokeWidth={1}
              strokeDasharray="4,3"
            />
          );
        })}

        {/* Stacked bars */}
        {buckets.map((bucket, i) => {
          const x = bucketToX(i);
          let yOffset = 0;
          return (
            <g key={bucket.start}>
              {STACK_ORDER.map((level) => {
                const count = bucket.counts[level] || 0;
                if (count === 0) return null;
                const bh = (count / maxTotal) * chartHeight;
                const y = MARGIN.top + chartHeight - yOffset - bh;
                yOffset += bh;
                return (
                  <rect
                    key={level}
                    className={LEVEL_FILL_CLASS[level]}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={bh}
                    rx={1}
                    fillOpacity={LEVEL_FILL_OPACITY[level] ?? 1}
                  />
                );
              })}
            </g>
          );
        })}

        {/* X-axis time labels */}
        {buckets.map((bucket, i) => {
          if (i % xLabelInterval !== 0) return null;
          const x = bucketToX(i) + barWidth / 2;
          return (
            <text
              key={bucket.start}
              x={x}
              y={svgHeight - MARGIN.bottom + 16}
              textAnchor="middle"
              fill={isDark ? "#737373" : "#a3a3a3"}
              fontSize={9}
            >
              {formatTime(bucket.start)}
            </text>
          );
        })}

        {/* Drag selection overlay */}
        {dragStart !== null && selectionW > 2 && (
          <rect
            x={selectionX}
            y={MARGIN.top}
            width={selectionW}
            height={chartHeight}
            fill="#2dd4bf"
            fillOpacity={0.12}
            stroke="#2dd4bf"
            strokeOpacity={0.5}
            strokeWidth={1}
            strokeDasharray="4,2"
            rx={2}
          />
        )}

        {/* Tooltip vertical line */}
        {tooltip && dragStart === null && (
          <line
            x1={tooltip.x}
            y1={MARGIN.top}
            x2={tooltip.x}
            y2={MARGIN.top + chartHeight}
            stroke={isDark ? "#555" : "#ccc"}
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}
      </svg>

      {/* HTML Tooltip */}
      {tooltip && dragStart === null && (
        <div
          className="absolute z-50 rounded-lg border border-base-300 bg-base-100 px-2.5 py-1.5 text-[11px] shadow-lg pointer-events-none"
          style={{
            left: Math.min(tooltip.x + 12, width - 180),
            marginTop: -(svgHeight + 10),
          }}
        >
          <div className="font-medium text-base-content mb-0.5">
            {formatTime(tooltip.bucket.start)} &ndash; {formatTime(tooltip.bucket.end)}
          </div>
          {STACK_ORDER.map((level) => {
            const count = tooltip.bucket.counts[level] || 0;
            if (count === 0) return null;
            return (
              <div key={level} className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 rounded-sm ${LEVEL_BG_CLASS[level]}`}
                />
                <span className="text-base-content/50">{level}:</span>
                <span className="text-base-content">{count}</span>
              </div>
            );
          })}
          <div className="border-t border-base-300 mt-0.5 pt-0.5 text-base-content/50">
            Total: {STACK_ORDER.reduce((s, l) => s + (tooltip.bucket.counts[l] || 0), 0)}
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-base-200/60 rounded-lg">
          <span className="loading loading-spinner loading-sm" />
          <span className="ml-2 text-sm text-base-content/40">Updating...</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 -mt-2 text-[10px] text-base-content/50">
        {STACK_ORDER.filter((l) =>
          buckets.some((b) => (b.counts[l] || 0) > 0),
        ).map((level) => {
          const total = buckets.reduce((s, b) => s + (b.counts[level] || 0), 0);
          return (
            <span key={level} className="flex items-center gap-1">
              <span
                className={`inline-block h-2 w-2 rounded-sm ${LEVEL_BG_CLASS[level]}`}
              />
              {level}: {total.toLocaleString()}
            </span>
          );
        })}
        <span>Total: {buckets.reduce((s, b) => s + STACK_ORDER.reduce((t, l) => t + (b.counts[l] || 0), 0), 0).toLocaleString()}</span>
      </div>

    </div>
  );
}
