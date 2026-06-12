export function QuickStepper({
  label,
  onDecrement,
  onIncrement,
  decrementDisabled,
}: {
  label: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled?: boolean;
}) {
  return (
    <span className="quick-stepper">
      <button
        aria-label={`Decrease ${label}`}
        disabled={decrementDisabled}
        type="button"
        onClick={onDecrement}
      >
        −
      </button>
      <button
        aria-label={`Increase ${label}`}
        type="button"
        onClick={onIncrement}
      >
        +
      </button>
    </span>
  );
}
