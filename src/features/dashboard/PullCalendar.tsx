import { useStore } from "../../store";

const DAYS_TO_SHOW = 90;
const DAY_SIZE = 11;
const DAY_GAP = 2;

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

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getCellOpacity(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 0.35;
  if (count === 2) return 0.6;
  return 0.9;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PullCalendar() {
  const pulls = useStore((s) => s.pulls);
  const pullsPerDay = getPullsPerDay(pulls);

  // Build the last 90 days, starting from the most recent Monday before/on 90 days ago
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startRaw = addDays(today, -(DAYS_TO_SHOW - 1));
  // Align to Monday (ISO weekday 1 = Monday)
  const startDow = startRaw.getDay(); // 0=Sun,1=Mon...6=Sat
  const daysBack = startDow === 0 ? 6 : startDow - 1; // days to go back to reach Monday
  const start = addDays(startRaw, -daysBack);

  // Build columns (weeks), each column is an array of days Mon-Sun
  const columns: { date: string; count: number }[][] = [];
  let current = new Date(start);

  while (current <= today) {
    const week: { date: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = formatDate(current);
      const isFuture = current > today;
      week.push({
        date: dateStr,
        count: isFuture ? -1 : (pullsPerDay.get(dateStr) || 0),
      });
      current = addDays(current, 1);
    }
    columns.push(week);
  }

  // Build month labels: for each column, check the first day — if it's a new month, label it
  const monthLabels: { colIndex: number; label: string }[] = [];
  let lastMonth = -1;
  columns.forEach((week, colIndex) => {
    const firstDay = new Date(week[0].date + "T00:00:00");
    const month = firstDay.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ colIndex, label: MONTH_NAMES[month] });
      lastMonth = month;
    }
  });

  const totalWidth = columns.length * (DAY_SIZE + DAY_GAP);
  const dayLabelWidth = 28;

  return (
    <div
      style={{
        backgroundColor: "var(--color-navy-800)",
        borderRadius: 12,
        padding: 16,
        border: "1px solid var(--color-navy-500)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
        Pull Calendar
        <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, marginLeft: 8 }}>
          last 90 days
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        {/* Month labels row */}
        <div
          style={{
            display: "flex",
            marginLeft: dayLabelWidth,
            marginBottom: 4,
            position: "relative",
            height: 14,
          }}
        >
          {monthLabels.map(({ colIndex, label }) => (
            <div
              key={`${colIndex}-${label}`}
              style={{
                position: "absolute",
                left: colIndex * (DAY_SIZE + DAY_GAP),
                fontSize: 10,
                color: "#9ca3af",
                whiteSpace: "nowrap",
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
                  color: i % 2 === 0 ? "#9ca3af" : "transparent",
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
                  const opacity = isFuture ? 0 : getCellOpacity(count);
                  const bg =
                    isFuture
                      ? "transparent"
                      : count === 0
                      ? "var(--color-navy-600)"
                      : `rgba(233, 69, 96, ${opacity})`;

                  return (
                    <div
                      key={date}
                      title={count >= 0 ? `${date}: ${count} pull${count !== 1 ? "s" : ""}` : ""}
                      style={{
                        width: DAY_SIZE,
                        height: DAY_SIZE,
                        borderRadius: 2,
                        backgroundColor: bg,
                        cursor: count > 0 ? "default" : "default",
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
            marginTop: 8,
            justifyContent: "flex-end",
          }}
        >
          <span style={{ fontSize: 10, color: "#9ca3af" }}>Less</span>
          {[0, 1, 2, 3].map((level) => (
            <div
              key={level}
              style={{
                width: DAY_SIZE,
                height: DAY_SIZE,
                borderRadius: 2,
                backgroundColor:
                  level === 0
                    ? "var(--color-navy-600)"
                    : `rgba(233, 69, 96, ${getCellOpacity(level)})`,
              }}
            />
          ))}
          <span style={{ fontSize: 10, color: "#9ca3af" }}>More</span>
        </div>
      </div>
    </div>
  );
}
