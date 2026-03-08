import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import type { CountryRecord } from "../game/gameTypes";

export interface CountryComboboxHandle {
  focusInput: () => void;
}

interface CountryComboboxProps {
  countries: CountryRecord[];
  disabled?: boolean;
  onInputFocusChange?: (isFocused: boolean) => void;
  onClear: () => void;
  onSubmit: (countryId: string) => void;
  selectedCountryId: string | null;
  variant?: "desktop" | "mobile";
}

export const CountryCombobox = forwardRef<CountryComboboxHandle, CountryComboboxProps>(
  function CountryCombobox(
    {
      countries,
      disabled = false,
      onInputFocusChange,
      onClear,
      onSubmit,
      selectedCountryId,
      variant = "desktop"
    },
    ref
  ) {
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const listboxId = "country-combobox-results";

    useImperativeHandle(ref, () => ({
      focusInput: () => {
        inputRef.current?.focus();
      }
    }));

    useEffect(() => {
      if (variant === "mobile") {
        if (!selectedCountryId) {
          setQuery("");
        }

        return;
      }

      if (!selectedCountryId || disabled) {
        return;
      }

      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    }, [disabled, selectedCountryId]);

    const filteredCountries = useMemo(() => {
      const normalizedQuery = query.trim().toLowerCase();

      if (!normalizedQuery) {
        return countries;
      }

      return countries.filter((country) =>
        country.displayName.toLowerCase().includes(normalizedQuery)
      );
    }, [countries, query]);

    const suggestedCountry = useMemo(() => {
      const normalizedQuery = query.toLowerCase();

      if (!normalizedQuery.trim()) {
        return null;
      }

      return (
        countries.find((country) =>
          country.displayName.toLowerCase().startsWith(normalizedQuery)
        ) ?? null
      );
    }, [countries, query]);

    const suggestedSuffix = useMemo(() => {
      if (!suggestedCountry) {
        return null;
      }

      const typedPrefix = query;

      if (!typedPrefix) {
        return null;
      }

      return suggestedCountry.displayName.slice(typedPrefix.length);
    }, [query, suggestedCountry]);

    const submitCountry = (countryId: string) => {
      setQuery("");
      setActiveIndex(0);

      // On mobile we want to keep the keyboard alive across guesses so the player
      // can keep typing through the next auto-selected country. Desktop still uses
      // the old blur-style flow because its listbox interaction is pointer-heavy.
      if (variant !== "mobile") {
        onInputFocusChange?.(false);
      }

      onSubmit(countryId);
    };

    const focusOption = (index: number) => {
      optionRefs.current[index]?.focus();
    };

    const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
      if (variant === "mobile") {
        if (event.key === "Enter") {
          event.preventDefault();

          if (suggestedCountry) {
            submitCountry(suggestedCountry.id);
          }

          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setQuery("");
          onInputFocusChange?.(false);
          onClear();
        }

        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((currentIndex) =>
          filteredCountries.length === 0
            ? 0
            : Math.min(currentIndex + 1, filteredCountries.length - 1)
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
        return;
      }

      if (event.key === "Tab" && !event.shiftKey && filteredCountries[activeIndex]) {
        event.preventDefault();
        focusOption(activeIndex);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        if (filteredCountries[activeIndex]) {
          submitCountry(filteredCountries[activeIndex].id);
        }

        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setQuery("");
        setActiveIndex(0);
        onInputFocusChange?.(false);
        onClear();
      }
    };

    return (
      <div
        className="combobox"
        onBlurCapture={(event) => {
          const nextFocusedElement = event.relatedTarget;

          if (
            !nextFocusedElement ||
            !(nextFocusedElement instanceof Node) ||
            !event.currentTarget.contains(nextFocusedElement)
          ) {
            onInputFocusChange?.(false);
          }
        }}
        onFocusCapture={() => {
          onInputFocusChange?.(true);
        }}
      >
        <div className="combobox__header">
          <div>
            <h2>{selectedCountryId ? "Name the selected country" : "Tap a country on the map"}</h2>
          </div>
        </div>
        <div
          className={[
            "combobox__input-shell",
            variant === "mobile" ? "combobox__input-shell--mobile" : ""
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {variant === "mobile" && suggestedCountry && suggestedSuffix ? (
            <div aria-hidden="true" className="combobox__ghost">
              <span className="combobox__ghost-prefix">{query}</span>
              <span className="combobox__ghost-suffix">{suggestedSuffix}</span>
            </div>
          ) : null}
          <input
            ref={inputRef}
            aria-autocomplete="list"
            aria-controls={variant === "desktop" ? listboxId : undefined}
            aria-expanded={
              variant === "desktop" ? !disabled && Boolean(selectedCountryId) : undefined
            }
            aria-label="Country autocomplete"
            autoCapitalize="none"
            autoComplete={variant === "mobile" ? "new-password" : "off"}
            autoCorrect="off"
            className={[
              "combobox__input",
              variant === "mobile" ? "combobox__input--mobile" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={variant === "desktop" ? disabled || !selectedCountryId : disabled}
            enterKeyHint={variant === "mobile" ? "go" : "search"}
            inputMode={variant === "mobile" ? "search" : "text"}
            name="atlas-country-query"
            placeholder={
              selectedCountryId
                ? "Type to search unsolved countries"
                : "Tap a country first"
            }
            readOnly={variant === "mobile" ? !selectedCountryId : undefined}
            spellCheck={false}
            type={variant === "mobile" ? "search" : "text"}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          {variant === "mobile" && selectedCountryId ? (
            <button
              aria-label="Submit country"
              className="combobox__submit"
              disabled={!suggestedCountry}
              type="button"
              onClick={() => {
                if (suggestedCountry) {
                  submitCountry(suggestedCountry.id);
                }
              }}
            >
              Go
            </button>
          ) : null}
        </div>
        {variant === "desktop" && !disabled && selectedCountryId ? (
          <ul className="combobox__list" id={listboxId} role="listbox">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country, index) => (
                <li key={country.id}>
                  <button
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    className={`combobox__option${
                      index === activeIndex ? " combobox__option--active" : ""
                    }`}
                    tabIndex={-1}
                    type="button"
                    onFocus={() => setActiveIndex(index)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        const nextIndex = Math.min(index + 1, filteredCountries.length - 1);
                        setActiveIndex(nextIndex);
                        focusOption(nextIndex);
                      }

                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        if (index === 0) {
                          inputRef.current?.focus();
                          return;
                        }

                        const previousIndex = index - 1;
                        setActiveIndex(previousIndex);
                        focusOption(previousIndex);
                      }

                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        submitCountry(country.id);
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        onInputFocusChange?.(false);
                        onClear();
                      }
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => submitCountry(country.id)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    {country.displayName}
                  </button>
                </li>
              ))
            ) : (
              <li className="combobox__empty">No unsolved country matches that search.</li>
            )}
          </ul>
        ) : null}
      </div>
    );
  }
);
