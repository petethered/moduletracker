import { useMemo, useState } from "react";
import { useStore } from "../../store";
import { formatDisplayDate, toDateString } from "../../utils/formatDate";

const DAYS_TO_SHOW = 90;
const DAY_SIZE = 12;
const DAY_GAP = 3;
const COL_STEP = DAY_SIZE + DAY_GAP;
const MIN_LABEL_GAP_PX = 28; // minimum pixels between month labels to avoid overlap
const MIN_LABEL_GAP_COLS = Math.ceil(MIN_LABEL_GAP_PX / COL_STEP);

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

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getIntensity(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

const INTENSITY_COLORS = [
  "var(--color-navy-600)",           // 0 pulls — empty cell
  "rgba(233, 69, 96, 0.3)",         // 1 pull
  "rgba(233, 69, 96, 0.55)",        // 2 pulls
  "rgba(233, 69, 96, 0.75)",        // 3-4 pulls
  "rgba(233, 69, 96, 0.95)",        // 5+ pulls
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PullCalendar() {
  const pulls = useStore((s) => s.pulls);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const pullsPerDay = getPullsPerDay(pulls);

  const todayStr = useMemo(() => toDateString(new Date()), []);

  // Build the last 90 days, starting from the most recent Monday before/on 90 days ago
  const { columns, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startRaw = addDays(today, -(DAYS_TO_SHOW - 1));
    const startDow = startRaw.getDay();
    const daysBack = startDow === 0 ? 6 : startDow - 1;
    const start = addDays(startRaw, -daysBack);

    const cols: { date: string; count: number }[][] = [];
    let current = new Date(start);

    while (current <= today) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = toDateString(current);
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
        lastMonth = month;
      }
    });

    return { columns: cols, monthLabels: labels };
  }, [pullsPerDay]);

  const hoveredInfo = hoveredDate
    ? { date: hoveredDate, count: pullsPerDay.get(hoveredDate) || 0 }
    : null;

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
        {/* Hover tooltip in header area */}
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
        {/* Month labels row */}
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
          {/* Day labels (Mon-Sun) */}
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

          {/* Calendar columns */}
          <div style={{ display: "flex", gap: DAY_GAP }}>
            {columns.map((week, colIdx) => (
              <div key={colIdx} style={{ display: "flex", flexDirection: "column", gap: DAY_GAP }}>
                {week.map(({ date, count }) => {
                  const isFuture = count === -1;
                  const isToday = date === todayStr;
                  const intensity = isFuture ? -1 : getIntensity(count);
                  const bg = isFuture ? "transparent" : INTENSITY_COLORS[intensity];

                  return (
                    <div
                      key={date}
                      onMouseEnter={() => !isFuture && setHoveredDate(date)}
                      onMouseLeave={() => setHoveredDate(null)}
                      style={{
                        width: DAY_SIZE,
                        height: DAY_SIZE,
                        borderRadius: 3,
                        backgroundColor: bg,
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

        {/* Legend */}
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
