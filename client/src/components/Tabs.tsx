export function Tabs({ value, options, onChange, label }: { value: string; options: { id: string; label: string }[]; onChange: (id: string) => void; label: string }) {
  return (
    <div className="tabs" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.id} type="button" aria-pressed={option.id === value} onClick={() => onChange(option.id)}>{option.label}</button>
      ))}
    </div>
  );
}
