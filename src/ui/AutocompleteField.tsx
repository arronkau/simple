import {
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

/**
 * A labelled text input with a suggestion listbox underneath: the catalog
 * picker on the inventory record form and the spell picker on the character
 * sheet. Typing filters (the parent computes `suggestions` from `value`),
 * arrow keys move the highlight, Enter or a click selects, Escape or a click
 * outside closes. Selecting hands the suggestion back to the parent, which
 * decides what to fill in.
 */
export function AutocompleteField<Suggestion>({
  label,
  value,
  onChange,
  suggestions,
  getSuggestionKey,
  renderSuggestion,
  onSelect,
  suggestionsLabel,
  inputProps,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: Suggestion[];
  getSuggestionKey: (suggestion: Suggestion) => string;
  renderSuggestion: (suggestion: Suggestion) => ReactNode;
  onSelect: (suggestion: Suggestion) => void;
  suggestionsLabel: string;
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "onFocus" | "onKeyDown" | "type" | "role"
  >;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const showSuggestions = open && suggestions.length > 0;
  const highlighted = showSuggestions ? suggestions[highlightedIndex] : undefined;
  const highlightedId = highlighted
    ? `${listboxId}-${getSuggestionKey(highlighted)}`
    : undefined;

  useEffect(() => {
    if (suggestions.length === 0) {
      setOpen(false);
      setHighlightedIndex(0);
      return;
    }

    setHighlightedIndex((currentIndex) =>
      Math.min(currentIndex, suggestions.length - 1),
    );
  }, [suggestions.length]);

  useEffect(() => {
    function closeOnOutsidePointerDown(event: PointerEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
    };
  }, []);

  function select(suggestion: Suggestion) {
    onSelect(suggestion);
    setOpen(false);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((currentIndex) =>
        open ? (currentIndex + 1) % suggestions.length : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((currentIndex) =>
        open
          ? (currentIndex - 1 + suggestions.length) % suggestions.length
          : suggestions.length - 1,
      );
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      select(suggestions[highlightedIndex]);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="autocomplete-field" ref={rootRef}>
      <label>
        <span>{label}</span>
        <input
          {...inputProps}
          aria-activedescendant={highlightedId}
          aria-autocomplete="list"
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
          autoComplete="off"
          role="combobox"
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setOpen(true);
              setHighlightedIndex(0);
            }
          }}
          onKeyDown={handleKeyDown}
        />
      </label>
      {showSuggestions ? (
        <div
          id={listboxId}
          className="autocomplete-suggestions"
          aria-label={suggestionsLabel}
          role="listbox"
        >
          {suggestions.map((suggestion, index) => {
            const key = getSuggestionKey(suggestion);

            return (
              <button
                id={`${listboxId}-${key}`}
                aria-selected={index === highlightedIndex}
                className={index === highlightedIndex ? "highlighted" : undefined}
                key={key}
                role="option"
                type="button"
                onClick={() => select(suggestion)}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onMouseEnter={() => {
                  setHighlightedIndex(index);
                }}
              >
                {renderSuggestion(suggestion)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
