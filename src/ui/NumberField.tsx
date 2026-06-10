export function NumberField({
  label,
  min = "0",
  onChange,
  step = "1",
  value,
}: {
  label: string;
  min?: string;
  onChange: (value: string) => void;
  step?: string;
  value: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        min={min}
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
