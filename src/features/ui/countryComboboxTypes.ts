import type { CountryRecord } from "../game/gameTypes";

export interface CountryComboboxHandle {
  focusInput: () => void;
}

export interface CountryComboboxProps {
  countries: CountryRecord[];
  disabled?: boolean;
  onInputFocusChange?: (isFocused: boolean) => void;
  onClear: () => void;
  onSubmit: (countryId: string) => void;
  selectedCountryId: string | null;
  variant?: "desktop" | "mobile";
}
