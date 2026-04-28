/**
 * PullCalendar.tsx
 *
 * Role: Dashboard heatmap (GitHub-contribution-graph style) showing how many
 * 10x pulls the user has done on each of the last 90 days.
 *
 * Game-domain concept:
 *   The Tower hands out free gems daily and bigger gem packages weekly, so
 *   pull cadence is a meaningful behavioral signal. Streaks of dark cells =
 *   active grinding sessions; light cells = the user logged in but didn't
 *   spend; empty cells = no pulls recorded that day. The heatmap helps the
 *   user spot their own patterns without scrubbing through a list.
 *
 * Selectors / store reads:
 *   - `useStore.pulls` — directly. We bucket by `pull.date` (ISO YYYY-MM-DD)
 *     locally rather than going through a selector because this view's
 *     bucketing is bespoke (per-day, last 90 days).
 *
 * Layout intent:
 *   - 7 rows (Mon–Sun) by N columns (one per ISO week). Always renders full
 *     weeks even if today isn't Sunday — empty future cells are kept as
 *     transparent placeholders so the bottom edge stays straight.
 *   - Month labels float above the grid, positioned absolutely by column.
 *   - A floating tooltip in the header tells the user the date + count of the
 *     hovered cell (kept in the header rather than as a popup so it never
 *     covers neighbouring cells).
 *   - Today's cell gets a crimson outline so it's locatable.
 *
 * Gotchas (don't break these):
 *   - Week starts on Monday. `startDow === 0` (Sunday) means we need to walk
 *     back 6 days, not 0. The `daysBack` calc encodes this.
 *   - Future cells (when today is mid-week) render but use `count === -1` as
 *     a sentinel so they're skipped for hover and rendered transparent.
 *   - Month labels can collide visually when months are short or the grid is
 *     dense. We skip a label if it would be within MIN_LABEL_GAP_COLS of the
 *     previous one — but always show the *first* label.
 */

import { useMemo, useState } from "react";
import { useStore } from "../../store";
import { formatDisplayDate, toDateString } from "../../utils/formatDate";
import { useRenderLog } from "../../utils/renderLog";

// 90-day window matches the GitHub contributions look but is short enough to
// fit without horizontal scroll on most desktops. Tune here if the design
// changes.
const DAYS_TO_SHOW = 90;
const DAY_SIZE = 12; // square cell side, px
const DAY_GAP = 3;  // gap between cells, px
const COL_STEP = DAY_SIZE + DAY_GAP; // distance from one column's left edge to the next
const MIN_LABEL_GAP_PX = 28; // minimum pixels between month labels to avoid overlap
// Convert px gap to "columns" so we can compare against `colIndex` deltas.
const MIN_LABEL_GAP_COLS = Math.ceil(MIN_LABEL_GAP_PX / COL_STEP);

/**
 * Bucket pulls into a Map keyed by YYYY-MM-DD with the count of pulls on
 * that date. We slice to 10 chars to be defensive against ISO timestamps
 * that include a time component — `toDateString` should normalize, but pulls
 * imported from older versions may have full ISO strings.
 */
function getPullsPerDay(
  pulls: { date: string }[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of pulls) {
    const key = p.date.slice(0, 10); // YYYY-MM-DD
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

/** Pure date arithmetic helper — never mutates the input. */
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Map a raw pull count to a 0-4 intensity bucket for the heatmap palette.
 * Buckets chosen empirically: a typical "I played today" session is 1-2
 * pulls; 3-4 is "active grinding"; 5+ is "heavy spend day".
 */
function getIntensity(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

// Crimson palette mirrors `--color-accent-crimson`. Hard-coded as RGBA here
// because we need varying alpha and CSS vars don't compose with rgba()
// without color-mix(). If the brand color changes, update both places.
const INTENSITY_COLORS = [
  "var(--color-navy-600)",           // 0 pulls — empty cell
  "rgba(233, 69, 96, 0.3)",         // 1 pull
  "rgba(233, 69, 96, 0.55)",        // 2 pulls
  "rgba(233, 69, 96, 0.75)",        // 3-4 pulls
  "rgba(233, 69, 96, 0.95)",        // 5+ pulls
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Mon-first week. Only every other label is shown (see render) to reduce
// visual noise; aligning to even-index rows keeps Mon/Wed/Fri visible.
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PullCalendar() {
  const pulls = useStore((s) => s.pulls);
  // Hovered date drives both the per-cell outline and the header tooltip.
  // Storing the date string (not the cell index) makes the lookup O(1).
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const pullsPerDay = useMemo(() => getPullsPerDay(pulls), [pulls]);
  useRenderLog("PullCalendar", { pullsLen: pulls.length, hoveredDate });

  // Today's date string, frozen for the lifetime of the component. If a user
  // leaves the dashboard open across midnight the "today" outline will be
  // stale until next render — acceptable trade-off vs. running a timer.
  const todayStr = useMemo(() => toDateString(new Date()), []);

  // Build the last 90 days, starting from the most recent Monday before/on 90 days ago
  const { columns, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // normalize to local midnight for comparisons

    // Anchor: the date 89 days ago (so the window is exactly DAYS_TO_SHOW long
    // inclusive of today). Then walk back to the preceding Monday so every
    // column starts on Monday.
    const startRaw = addDays(today, -(DAYS_TO_SHOW - 1));
    const startDow = startRaw.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    // JS Sunday is 0, but we treat Mon as week-start. So Sunday must walk back
    // 6 days to reach the previous Monday; everything else walks back
    // (dow - 1) days.
    const daysBack = startDow === 0 ? 6 : startDow - 1;
    const start = addDays(startRaw, -daysBack);

    // Walk forward in 7-day chunks. Each chunk is a column (one ISO week).
    const cols: { date: string; count: number }[][] = [];
    let current = new Date(start);

    while (current <= today) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = toDateString(current);
        // If today is mid-week, the trailing days of the current week are in
        // the future — mark them with the -1 sentinel so the renderer skips
        // both interaction and styling.
        const isFuture = current > today;
        week.push({
          date: dateStr,
          count: isFuture ? -1 : (pullsPerDay.get(dateStr) || 0),
        });
        current = addDays(current, 1);
      }
      cols.push(week);
    }

    // Build month labels, skipping any that would overlap with the previous label
    // We label a column when its first day's month differs from the last month
    // we labeled, BUT we skip if it would visually collide with the previous
    // label. The very first label is always rendered (`labels.length === 0`).
    const labels: { colIndex: number; label: string }[] = [];
    let lastMonth = -1;
    let lastLabelCol = -Infinity;
    cols.forEach((week, colIndex) => {
      const month = Number(week[0].date.split("-")[1]) - 1; // 0-indexed
      if (month !== lastMonth) {
        if (colIndex - lastLabelCol >= MIN_LABEL_GAP_COLS || labels.length === 0) {
          labels.push({ colIndex, label: MONTH_NAMES[month] });
          lastLabelCol = colIndex;
        }
        // Always advance `lastMonth` even when we skip the label, otherwise
        // we'd retry the same month every column.
        lastMonth = month;
      }
    });

    return { columns: cols, monthLabels: labels };
  }, [pullsPerDay]);

  // Derived hover info, lifted out so JSX stays terse.
  const hoveredInfo = hoveredDate
    ? { date: hoveredDate, count: pullsPerDay.get(hoveredDate) || 0 }
    : null;

  // Width reserved on the left for "Mon/Wed/Fri" day labels. Must match the
  // grid's left padding so month labels (positioned absolutely) align with
  // their columns.
  const dayLabelWidth = 28;

  return (
    <div
      style={{
        backgroundColor: "var(--color-navy-800)",
        borderRadius: 12,
        padding: "16px 16px 12px",
        border: "1px solid var(--color-navy-500)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Pull Calendar</span>
          <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 400 }}>
            last {DAYS_TO_SHOW} days
          </span>
        </div>
        {/* Hover tooltip in header area.
            We keep this slot present at all times (transparent text + nbsp)
            so the layout doesn't jitter when the user moves between cells. */}
        <div
          style={{
            fontSize: 11,
            color: hoveredInfo ? "#c8c8d8" : "transparent",
            fontVariantNumeric: "tabular-nums",
            minWidth: 120,
            textAlign: "right",
            transition: "color 0.15s",
          }}
        >
          {hoveredInfo
            ? `${formatDisplayDate(hoveredInfo.date)} · ${hoveredInfo.count} pull${hoveredInfo.count !== 1 ? "s" : ""}`
            : "\u00A0"}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        {/* Month labels row.
            Positioned absolutely within a relative parent so each label can
            sit directly above its column without participating in normal flow.
            `marginLeft: dayLabelWidth` shifts the entire band right to clear
            the day-label column. */}
        <div
          style={{
            marginLeft: dayLabelWidth,
            marginBottom: 6,
            position: "relative",
            height: 14,
          }}
        >
          {monthLabels.map(({ colIndex, label }) => (
            <div
              key={`${colIndex}-${label}`}
              style={{
                position: "absolute",
                left: colIndex * COL_STEP,
                fontSize: 10,
                fontWeight: 500,
                color: "#9ca3af",
                whiteSpace: "nowrap",
                letterSpacing: "0.02em",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grid: day labels + calendar cells */}
        <div style={{ display: "flex", gap: 4 }}>
          {/* Day labels (Mon-Sun).
              Only even-indexed rows (Mon/Wed/Fri/Sun) show text; odd rows
              render as transparent spacers so vertical alignment with the
              cells is preserved. */}
          <div style={{ display: "flex", flexDirection: "column", gap: DAY_GAP, width: dayLabelWidth }}>
            {DAY_LABELS.map((d, i) => (
              <div
                key={d}
                style={{
                  height: DAY_SIZE,
                  fontSize: 9,
                  color: i % 2 === 0 ? "#6b7280" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  userSelect: "none",
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar columns — one column per ISO week, top-down Mon..Sun. */}
          <div style={{ display: "flex", gap: DAY_GAP }}>
            {columns.map((week, colIdx) => (
              <div key={colIdx} style={{ display: "flex", flexDirection: "column", gap: DAY_GAP }}>
                {week.map(({ date, count }) => {
                  // -1 sentinel = future date (today is mid-week). Render an
                  // invisible placeholder to preserve the rectangular shape.
                  const isFuture = count === -1;
                  const isToday = date === todayStr;
                  const intensity = isFuture ? -1 : getIntensity(count);
                  const bg = isFuture ? "transparent" : INTENSITY_COLORS[intensity];

                  return (
                    <div
                      key={date}
                      // Future cells get neither hover nor pointer cursor —
                      // they're not real data points.
                      onMouseEnter={() => !isFuture && setHoveredDate(date)}
                      onMouseLeave={() => setHoveredDate(null)}
                      style={{
                        width: DAY_SIZE,
                        height: DAY_SIZE,
                        borderRadius: 3,
                        backgroundColor: bg,
                        // Outline priority: today's cell wins over hover, so a
                        // user hovering today still sees the crimson ring.
                        // `outlineOffset: -0.5` pulls the outline inward so it
                        // doesn't visually grow the cell.
                        outline: isToday
                          ? "1.5px solid rgba(233, 69, 96, 0.7)"
                          : hoveredDate === date
                          ? "1.5px solid rgba(200, 200, 216, 0.4)"
                          : "none",
                        outlineOffset: isToday || hoveredDate === date ? -0.5 : 0,
                        transition: "outline 0.1s, background-color 0.1s",
                        cursor: isFuture ? "default" : "pointer",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend — five swatches from "Less" to "More" mirroring the
            INTENSITY_COLORS palette. Anchored to the right so it lines up
            with the right edge of the grid in the common case. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 10,
            justifyContent: "flex-end",
          }}
        >
          <span style={{ fontSize: 10, color: "#6b7280", marginRight: 2 }}>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              style={{
                width: DAY_SIZE,
                height: DAY_SIZE,
                borderRadius: 3,
                backgroundColor: INTENSITY_COLORS[level],
              }}
            />
          ))}
          <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 2 }}>More</span>
        </div>
      </div>
    </div>
  );
}
