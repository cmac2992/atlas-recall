import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CountryId, CountryRecord } from "../game/gameTypes";
import {
  type CameraState,
  SELECTION_CAMERA_PADDING,
  cameraToViewBox,
  createInitialCamera,
  expandBounds,
  getSelectionTargetCamera,
  interpolateCamera,
  panCamera,
  parseViewBox,
  shouldAnimateSelectionCamera,
  zoomCameraAtPoint
} from "./mapGeometry";

interface WorldMapProps {
  countries: CountryRecord[];
  flashEvent: {
    countryId: CountryId;
    variant: "correct" | "wrong";
    token: number;
  } | null;
  onCountrySelect: (countryId: CountryId) => void;
  selectedCountryId: CountryId | null;
  solvedCountryIds: CountryId[];
  viewBox: string;
}

interface GestureState {
  pointerId: number;
  startX: number;
  startY: number;
  startViewBox: ReturnType<typeof createInitialCamera>;
}

interface CameraAnimationState {
  from: CameraState;
  startAt: number;
  target: CameraState;
}

function getCountryIdFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest("[data-country-id]")?.getAttribute("data-country-id") ?? null;
}

function getCountryIdFromPoint(clientX: number, clientY: number) {
  if (
    typeof document === "undefined" ||
    typeof document.elementFromPoint !== "function"
  ) {
    return null;
  }

  return getCountryIdFromTarget(document.elementFromPoint(clientX, clientY));
}

// Ease in and out so auto camera moves feel more natural than a straight linear slide.
function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress ** 3
    : 1 - ((-2 * progress + 2) ** 3) / 2;
}

export const WorldMap = memo(function WorldMap({
  countries,
  flashEvent,
  onCountrySelect,
  selectedCountryId,
  solvedCountryIds,
  viewBox
}: WorldMapProps) {
  const worldBounds = useMemo(() => parseViewBox(viewBox), [viewBox]);
  const cameraBounds = useMemo(
    () => expandBounds(worldBounds, SELECTION_CAMERA_PADDING),
    [worldBounds]
  );
  const initialCamera = useMemo(() => createInitialCamera(cameraBounds), [cameraBounds]);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCountryId, setHoveredCountryId] = useState<CountryId | null>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const draggingRef = useRef(false);
  const flashTimeoutRef = useRef<number | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationRef = useRef<CameraAnimationState | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const cameraRef = useRef<CameraState>(initialCamera);
  const previousSelectedCountryIdRef = useRef<CountryId | null>(null);
  const solvedCountryIdSet = useMemo(() => new Set(solvedCountryIds), [solvedCountryIds]);

  // The camera lives in refs plus direct SVG updates so dragging does not rerender
  // every country path on every pointer move.
  useEffect(() => {
    cameraRef.current = initialCamera;

    if (svgRef.current) {
      svgRef.current.setAttribute("viewBox", cameraToViewBox(initialCamera));
    }
  }, [initialCamera]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
      }

      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
      }

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;

    if (!svg) {
      return;
    }

    // React registers wheel listeners as passive in modern browsers, which means
    // `preventDefault()` is ignored. We attach our own native listener so zooming
    // the map does not also scroll the page.
    const handleNativeWheel = (event: WheelEvent) => {
      const rect = svg.getBoundingClientRect();
      const focusRatioX = (event.clientX - rect.left) / rect.width;
      const focusRatioY = (event.clientY - rect.top) / rect.height;
      const zoomFactor = event.deltaY < 0 ? 1.18 : 1 / 1.18;

      if (event.cancelable) {
        event.preventDefault();
      }

      stopCameraAnimation();
      renderCamera(
        zoomCameraAtPoint(
          cameraRef.current,
          cameraBounds,
          cameraRef.current.zoom * zoomFactor,
          focusRatioX,
          focusRatioY
        )
      );
    };

    svg.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      svg.removeEventListener("wheel", handleNativeWheel);
    };
  }, [cameraBounds]);

  const renderCamera = (nextCamera: CameraState) => {
    cameraRef.current = nextCamera;

    if (renderFrameRef.current !== null) {
      return;
    }

    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;

      if (svgRef.current) {
        svgRef.current.setAttribute("viewBox", cameraToViewBox(cameraRef.current));
      }
    });
  };

  // Manual interaction should immediately take control back from any auto camera move.
  const stopCameraAnimation = () => {
    animationRef.current = null;

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const animateCameraUpdate = (targetCamera: CameraState) => {
    stopCameraAnimation();
    animationRef.current = {
      from: cameraRef.current,
      startAt: performance.now(),
      target: targetCamera
    };

    const step = (now: number) => {
      const animation = animationRef.current;

      if (!animation) {
        return;
      }

      const progress = Math.min(1, (now - animation.startAt) / 240);
      const easedProgress = easeInOutCubic(progress);
      renderCamera(
        interpolateCamera(
          animation.from,
          animation.target,
          easedProgress,
          cameraBounds
        )
      );

      if (progress >= 1) {
        animationRef.current = null;
        animationFrameRef.current = null;
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(step);
    };

    animationFrameRef.current = window.requestAnimationFrame(step);
  };

  const flashCountry = (
    countryId: CountryId,
    variant: "correct" | "wrong"
  ) => {
    const svg = svgRef.current;

    if (!svg) {
      return;
    }

    const countryPath = svg.querySelector<SVGPathElement>(
      `path.world-map__country[data-country-id="${countryId}"]`
    );

    if (!countryPath) {
      return;
    }

    countryPath.classList.remove("world-map__country--flash");
    countryPath.classList.remove("world-map__country--flash-correct");
    countryPath.classList.remove("world-map__country--flash-wrong");
    void countryPath.getBoundingClientRect();
    countryPath.classList.add("world-map__country--flash");
    countryPath.classList.add(
      variant === "correct"
        ? "world-map__country--flash-correct"
        : "world-map__country--flash-wrong"
    );

    if (flashTimeoutRef.current !== null) {
      window.clearTimeout(flashTimeoutRef.current);
    }

    flashTimeoutRef.current = window.setTimeout(() => {
      countryPath.classList.remove("world-map__country--flash");
      countryPath.classList.remove("world-map__country--flash-correct");
      countryPath.classList.remove("world-map__country--flash-wrong");
      flashTimeoutRef.current = null;
    }, 320);
  };

  useEffect(() => {
    if (!flashEvent) {
      return;
    }

    flashCountry(flashEvent.countryId, flashEvent.variant);
  }, [flashEvent]);

  useEffect(() => {
    if (!selectedCountryId) {
      previousSelectedCountryIdRef.current = null;
      return;
    }

    // Clicking the already-selected country should not restart the whole camera move.
    if (previousSelectedCountryIdRef.current === selectedCountryId) {
      return;
    }

    previousSelectedCountryIdRef.current = selectedCountryId;
    const selectedCountry = countries.find((country) => country.id === selectedCountryId);

    if (!selectedCountry) {
      return;
    }

    const targetCamera = getSelectionTargetCamera(
      cameraRef.current,
      cameraBounds,
      selectedCountry
    );

    if (
      !shouldAnimateSelectionCamera(
        cameraRef.current,
        targetCamera,
        worldBounds,
        selectedCountry
      )
    ) {
      return;
    }

    animateCameraUpdate(targetCamera);
  }, [cameraBounds, countries, selectedCountryId, worldBounds]);

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.pointerType !== "touch") {
      return;
    }

    setHoveredCountryId(getCountryIdFromTarget(event.target));
    setIsDragging(false);
    draggingRef.current = false;
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startViewBox: cameraRef.current
    };

    if ("setPointerCapture" in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;

    if (!gesture) {
      setHoveredCountryId(getCountryIdFromTarget(event.target));
      return;
    }

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (!draggingRef.current && Math.hypot(deltaX, deltaY) > 4) {
      // Re-anchor drag math to the live camera so panning does not jump if the
      // user starts dragging while an auto-center animation was running.
      stopCameraAnimation();
      gesture.startX = event.clientX;
      gesture.startY = event.clientY;
      gesture.startViewBox = cameraRef.current;
      draggingRef.current = true;
      setIsDragging(true);
      setHoveredCountryId(null);
      return;
    }

    if (!draggingRef.current) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const viewBoxDeltaX = (-deltaX / rect.width) * gesture.startViewBox.width;
    const viewBoxDeltaY = (-deltaY / rect.height) * gesture.startViewBox.height;

    renderCamera(
      panCamera(gesture.startViewBox, cameraBounds, viewBoxDeltaX, viewBoxDeltaY)
    );
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    if (!draggingRef.current) {
      const countryId =
        getCountryIdFromPoint(event.clientX, event.clientY) ??
        getCountryIdFromTarget(event.target);

      if (countryId && !solvedCountryIdSet.has(countryId)) {
        onCountrySelect(countryId);
      }
    }

    gestureRef.current = null;
    draggingRef.current = false;
    setIsDragging(false);
    if ("releasePointerCapture" in event.currentTarget) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const nudgeZoom = (factor: number) => {
    stopCameraAnimation();
    renderCamera(
      zoomCameraAtPoint(
        cameraRef.current,
        cameraBounds,
        cameraRef.current.zoom * factor,
        0.5,
        0.5
      )
    );
  };

  return (
    <section className="map-card">
      <div className="map-frame">
        <div className="map-controls">
          <button
            aria-label="Zoom in"
            className="map-controls__button map-controls__button--zoom"
            type="button"
            onClick={() => nudgeZoom(1.22)}
          >
            <span aria-hidden="true">+</span>
          </button>
          <button
            aria-label="Zoom out"
            className="map-controls__button map-controls__button--zoom"
            type="button"
            onClick={() => nudgeZoom(1 / 1.22)}
          >
            <span aria-hidden="true">-</span>
          </button>
          <button
            className="map-controls__button map-controls__button--reset"
            type="button"
            onClick={() => {
              stopCameraAnimation();
              renderCamera(initialCamera);
            }}
          >
            Reset
          </button>
        </div>
        <svg
          aria-label="World map"
          className={[
            "world-map",
            isDragging ? "world-map--dragging" : ""
          ]
            .filter(Boolean)
            .join(" ")}
          ref={svgRef}
          onPointerDown={handlePointerDown}
          onPointerLeave={() => setHoveredCountryId(null)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          viewBox={cameraToViewBox(initialCamera)}
        >
          <rect
            className="world-map__background"
            height={cameraBounds.height}
            width={cameraBounds.width}
            x={cameraBounds.minX}
            y={cameraBounds.minY}
          />
          {countries.map((country) => {
            const isHovered = country.id === hoveredCountryId;
            const isSolved = solvedCountryIdSet.has(country.id);
            const isSelected = country.id === selectedCountryId;

            return (
              <path
                key={country.id}
                aria-label={country.displayName}
                className={[
                  "world-map__country",
                  !isSolved ? "world-map__country--interactive" : "",
                  isSolved ? "world-map__country--disabled" : "",
                  isSelected ? "world-map__country--selected" : "",
                  isSolved ? "world-map__country--solved" : "",
                  isHovered ? "world-map__country--hovered" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-country-id={country.id}
                d={country.svgPath}
                onPointerEnter={() => setHoveredCountryId(country.id)}
              />
            );
          })}
        </svg>
      </div>
      <p className="map-card__hint">
        Drag to pan. Scroll or use +/- to zoom.
      </p>
    </section>
  );
});
