import { useSearchParams } from "react-router-dom";

export function useFilterParams() {
  const [params, setParams] = useSearchParams();
  function setFilter(key: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  }
  return { params, setFilter };
}

export function FilterBar({
  label,
  search,
  onSearch,
  segments,
  segment,
  onSegment,
  chips,
  chip,
  onChip,
}: {
  label: string;
  search?: string;
  onSearch?: (value: string) => void;
  segments?: { id: string; label: string }[];
  segment?: string;
  onSegment?: (id: string) => void;
  chips?: { id: string; label: string }[];
  chip?: string;
  onChip?: (id: string) => void;
}) {
  return (
    <div className="filter-bar" role="search" aria-label={label}>
      {segments && onSegment && (
        <div className="segmented" role="group" aria-label={`${label} status`}>
          {segments.map((item) => (
            <button key={item.id} type="button" aria-pressed={segment === item.id} onClick={() => onSegment(item.id)}>{item.label}</button>
          ))}
        </div>
      )}
      {chips && onChip && (
        <div className="chip-row" role="group" aria-label={`${label} filters`}>
          {chips.map((item) => (
            <button key={item.id} type="button" className="chip" aria-pressed={chip === item.id} onClick={() => onChip(item.id)}>{item.label}</button>
          ))}
        </div>
      )}
      {onSearch && (
        <label className="filter-search">
          <span className="visually-hidden">Search</span>
          <input value={search ?? ""} onChange={(event) => onSearch(event.target.value)} placeholder="Search" />
        </label>
      )}
    </div>
  );
}
