import { useStore } from "../../store";
import { MODULES, MODULES_BY_TYPE } from "../../config/modules";
import { selectModulePullCounts } from "../../store/selectors";

const TYPE_COLORS: Record<string, string> = {
  cannon: "#e94560",
  armor: "#3b82f6",
  generator: "#eab308",
  core: "#a855f7",
};

const TYPE_ORDER = ["cannon", "armor", "generator", "core"] as const;

/** Abbreviate a module name to 2-4 chars for compact display */
function abbrev(name: string): string {
  const words = name.split(/[\s-]+/);
  if (words.length === 1) return name.slice(0, 4);
  // Use first letter of first two words if short enough, else initials
  if (words.length >= 2 && words[0].length + words[1].length <= 5) {
    return (words[0].slice(0, 2) + words[1].slice(0, 2)).toUpperCase();
  }
  return words.map((w) => w[0]).join("").toUpperCase().slice(0, 4);
}

export function ModuleCollectionGrid() {
  const pulls = useStore((s) => s.pulls);
  const counts = selectModulePullCounts(pulls);
  const foundCount = Object.keys(counts).length;
  const totalCount = MODULES.length;

  return (
    <div
      style={{
        backgroundColor: "var(--color-navy-800)",
        borderRadius: 12,
        padding: 16,
        border: "1px solid var(--color-navy-500)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>Collection</span>
        <span style={{ fontSize: 13, color: "#9ca3af" }}>
          {foundCount}/{totalCount}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {TYPE_ORDER.map((type) => {
          const color = TYPE_COLORS[type];
          const modules = MODULES_BY_TYPE[type];
          return (
            <div key={type}>
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color,
                  marginBottom: 4,
                  fontWeight: 600,
                }}
              >
                {type}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 4,
                }}
              >
                {modules.map((mod) => {
                  const found = (counts[mod.id] || 0) > 0;
                  return (
                    <div
                      key={mod.id}
                      title={mod.name}
                      style={{
                        padding: "4px 6px",
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 500,
                        textAlign: "center",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        backgroundColor: found
                          ? color + "33"
                          : "var(--color-navy-700)",
                        border: `1px solid ${found ? color + "88" : "var(--color-navy-500)"}`,
                        color: found ? color : "#6b7280",
                        cursor: "default",
                        userSelect: "none",
                      }}
                    >
                      {abbrev(mod.name)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
