import { useEffect, useMemo, useRef, useState } from "react";
import type { CountryRecord } from "../game/gameTypes";

interface CountryComboboxProps {
  countries: CountryRecord[];
  disabled?: boolean;
  onClear: () => void;
  onSubmit: (countryId: string) => void;
  selectedCountryId: string | null;
}

export function CountryCombobox({
  countries,
  disabled = false,
  onClear,
  onSubmit,
  selectedCountryId
}: CountryComboboxProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = "country-combobox-results";

  useEffect(() => {
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

  const submitCountry = (countryId: string) => {
    setQuery("");
    setActiveIndex(0);
    onSubmit(countryId);
  };

  const focusOption = (index: number) => {
    optionRefs.current[index]?.focus();
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
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
      onClear();
    }
  };

  return (
    <div className="combobox">
      <div className="combobox__header">
        <div>
          <p className="eyebrow">Name mode</p>
          <h2>{selectedCountryId ? "Name the selected country" : "Select a country on the map"}</h2>
        </div>
      </div>
      <input
        ref={inputRef}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={!disabled && Boolean(selectedCountryId)}
        aria-label="Country autocomplete"
        className="combobox__input"
        disabled={disabled || !selectedCountryId}
        placeholder={
          selectedCountryId
            ? "Type to search unsolved countries"
            : "Select a country on the map first"
        }
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
      />
      {!disabled && selectedCountryId ? (
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
                      onClear();
                    }
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    submitCountry(country.id);
                  }}
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
