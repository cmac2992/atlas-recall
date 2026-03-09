import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import type {
  CountryComboboxHandle,
  CountryComboboxProps
} from "./countryComboboxTypes";
import {
  getSuggestedCountry,
  getSuggestedSuffix
} from "./countryComboboxUtils";

export const MobileCountryCombobox = forwardRef<
  CountryComboboxHandle,
  CountryComboboxProps
>(function MobileCountryCombobox(
  {
    countries,
    disabled = false,
    onInputFocusChange,
    onClear,
    onSubmit,
    selectedCountryId
  },
  ref
) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useImperativeHandle(ref, () => ({
    focusInput: () => {
      inputRef.current?.focus();
    }
  }));

  useEffect(() => {
    if (!selectedCountryId) {
      setQuery("");
    }
  }, [selectedCountryId]);

  const suggestedCountry = useMemo(
    () => getSuggestedCountry(countries, query),
    [countries, query]
  );
  const suggestedSuffix = useMemo(
    () => getSuggestedSuffix(query, suggestedCountry),
    [query, suggestedCountry]
  );

  const submitCountry = (countryId: string) => {
    setQuery("");
    onSubmit(countryId);
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
      <div className="combobox__input-shell combobox__input-shell--mobile">
        {suggestedCountry && suggestedSuffix ? (
          <div aria-hidden="true" className="combobox__ghost">
            <span className="combobox__ghost-prefix">{query}</span>
            <span className="combobox__ghost-suffix">{suggestedSuffix}</span>
          </div>
        ) : null}
        <input
          ref={inputRef}
          aria-autocomplete="list"
          aria-label="Country autocomplete"
          autoCapitalize="none"
          autoComplete="new-password"
          autoCorrect="off"
          className="combobox__input combobox__input--mobile"
          disabled={disabled}
          enterKeyHint="go"
          inputMode="search"
          name="atlas-country-query"
          placeholder={
            selectedCountryId
              ? "Type to search unsolved countries"
              : "Tap a country first"
          }
          readOnly={!selectedCountryId}
          spellCheck={false}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
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
          }}
        />
        {selectedCountryId ? (
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
    </div>
  );
});
