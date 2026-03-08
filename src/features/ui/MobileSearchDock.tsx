import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import type { CSSProperties } from "react";
import type { CountryRecord } from "../game/gameTypes";
import {
  CountryCombobox,
  type CountryComboboxHandle
} from "./CountryCombobox";

export interface MobileSearchDockHandle {
  focusInput: () => void;
}

interface MobileSearchDockProps {
  availableCountries: CountryRecord[];
  onClearSelection: () => void;
  onSubmitCountryName: (countryId: string) => void;
  onViewportBottomChange: (bottomPx: number) => void;
  selectedCountryId: string | null;
}

export const MobileSearchDock = memo(
  forwardRef<MobileSearchDockHandle, MobileSearchDockProps>(function MobileSearchDock(
    {
      availableCountries,
      onClearSelection,
      onSubmitCountryName,
      onViewportBottomChange,
      selectedCountryId
    },
    ref
  ) {
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [keyboardOffset, setKeyboardOffset] = useState(0);
    const dockRef = useRef<HTMLElement | null>(null);
    const comboboxRef = useRef<CountryComboboxHandle | null>(null);

    useImperativeHandle(ref, () => ({
      focusInput: () => {
        comboboxRef.current?.focusInput();
      }
    }));

    useEffect(() => {
      if (!selectedCountryId) {
        setIsInputFocused(false);
      }
    }, [selectedCountryId]);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }

      const updateKeyboardOffset = () => {
        const viewport = window.visualViewport;

        if (!viewport) {
          setKeyboardOffset(0);
          return;
        }

        setKeyboardOffset(
          Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        );
      };

      updateKeyboardOffset();
      window.visualViewport?.addEventListener("resize", updateKeyboardOffset);
      window.visualViewport?.addEventListener("scroll", updateKeyboardOffset);

      return () => {
        window.visualViewport?.removeEventListener("resize", updateKeyboardOffset);
        window.visualViewport?.removeEventListener("scroll", updateKeyboardOffset);
      };
    }, []);

    useEffect(() => {
      const dockElement = dockRef.current;

      if (!dockElement || typeof window === "undefined") {
        return;
      }

      const updateVisibleBottom = () => {
        // The dock rect is reported in visual viewport coordinates, so use the same
        // coordinate space when handing it off to the map. The map can then compare
        // this against its own SVG rect instead of pretending the map always starts
        // at the top of the viewport.
        onViewportBottomChange(dockElement.getBoundingClientRect().top);
      };

      const resizeObserver =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(updateVisibleBottom);

      resizeObserver?.observe(dockElement);
      window.addEventListener("resize", updateVisibleBottom);
      window.visualViewport?.addEventListener("resize", updateVisibleBottom);
      window.visualViewport?.addEventListener("scroll", updateVisibleBottom);
      window.requestAnimationFrame(updateVisibleBottom);

      return () => {
        resizeObserver?.disconnect();
        window.removeEventListener("resize", updateVisibleBottom);
        window.visualViewport?.removeEventListener("resize", updateVisibleBottom);
        window.visualViewport?.removeEventListener("scroll", updateVisibleBottom);
      };
    }, [isInputFocused, keyboardOffset, onViewportBottomChange, selectedCountryId]);

    const dockStyle = {
      "--keyboard-offset": `${keyboardOffset}px`
    } as CSSProperties;

    return (
      <aside
        className={[
          "mobile-search-dock",
          isInputFocused ? "mobile-search-dock--typing" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        ref={dockRef}
        style={dockStyle}
      >
        <CountryCombobox
          ref={comboboxRef}
          countries={availableCountries}
          onClear={onClearSelection}
          onInputFocusChange={setIsInputFocused}
          onSubmit={onSubmitCountryName}
          selectedCountryId={selectedCountryId}
          variant="mobile"
        />
      </aside>
    );
  })
);
