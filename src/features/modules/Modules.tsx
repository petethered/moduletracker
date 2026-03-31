import { ModuleTable } from "./ModuleTable";

export function Modules() {
  return (
    <div>
      <h2 className="text-lg text-[var(--color-accent-gold)]/80 mb-6" style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "0.06em" }}>Module Collection</h2>
      <ModuleTable />
    </div>
  );
}
