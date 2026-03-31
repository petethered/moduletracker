import { useState } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (item: T) => string | number;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = "No data",
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedData = [...data];
  if (sortKey) {
    const col = columns.find((c) => c.key === sortKey);
    if (col?.sortValue) {
      sortedData.sort((a, b) => {
        const aVal = col.sortValue!(a);
        const bVal = col.sortValue!(b);
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
  }

  if (data.length === 0) {
    return (
      <div className="text-center text-gray-600 py-16" style={{ fontFamily: "var(--font-body)" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-navy-500)]/30 bg-[var(--color-navy-800)]/40">
      <table className="w-full text-sm" style={{ fontFamily: "var(--font-body)" }}>
        <thead>
          <tr className="border-b border-[var(--color-navy-500)]/40">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                className={`px-3 py-3 text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium ${
                  col.sortable ? "cursor-pointer hover:text-gray-300 transition-colors" : ""
                }`}
              >
                {col.header}
                {sortKey === col.key && (
                  <span className="text-[var(--color-accent-gold)] ml-1">
                    {sortDir === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={`border-b border-[var(--color-navy-600)]/30 transition-colors ${
                onRowClick
                  ? "cursor-pointer hover:bg-[var(--color-navy-600)]/40"
                  : ""
              }`}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-3">
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
