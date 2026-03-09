import { forwardRef } from "react";
import { DesktopCountryCombobox } from "./DesktopCountryCombobox";
import { MobileCountryCombobox } from "./MobileCountryCombobox";
import type {
  CountryComboboxHandle,
  CountryComboboxProps
} from "./countryComboboxTypes";

export type { CountryComboboxHandle } from "./countryComboboxTypes";

export const CountryCombobox = forwardRef<CountryComboboxHandle, CountryComboboxProps>(
  function CountryCombobox(props, ref) {
    if (props.variant === "mobile") {
      return <MobileCountryCombobox {...props} ref={ref} />;
    }

    return <DesktopCountryCombobox {...props} ref={ref} />;
  }
);
