import type { ReactNode } from "react";

export type Column<T> = {
  id: string;
  header: string;
  sortable?: boolean;
  render: (row: T) => ReactNode;
};

export function DataTable<T extends { id: string }>({
  caption,
  columns,
  rows,
  sort,
  dir,
  onSort,
  selectedId,
  onSelect,
  empty,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  sort?: string;
  dir?: "asc" | "desc";
  onSort?: (id: string) => void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  empty: string;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort === column.id;
              const ariaSort = !column.sortable ? undefined : active ? (dir === "asc" ? "ascending" : "descending") : "none";
              return (
                <th key={column.id} aria-sort={ariaSort} scope="col">
                  {column.sortable && onSort ? (
                    <button type="button" className="sort-btn" onClick={() => onSort(column.id)}>
                      {column.header}
                      {active ? (dir === "asc" ? " ascending" : " descending") : ""}
                    </button>
                  ) : column.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.id}
              className={selectedId === row.id ? "selected" : undefined}
              onClick={onSelect ? () => onSelect(row.id) : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onKeyDown={onSelect ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(row.id);
                }
              } : undefined}
            >
              {columns.map((column) => <td key={column.id}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
