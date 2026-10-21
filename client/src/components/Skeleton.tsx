export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => <i key={index} style={{ width: `${88 - index * 12}%` }} />)}
    </div>
  );
}
