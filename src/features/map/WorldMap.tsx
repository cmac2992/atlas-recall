import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CountryId, CountryRecord } from "../game/gameTypes";
import {
  type CameraState,
  DESKTOP_SELECTION_VIEWPORT,
  SELECTION_CAMERA_PADDING,
  type SelectionViewportRect,
  cameraToViewBox,
  clampCamera,
  createInitialCamera,
  expandBounds,
  getSelectionTargetCamera,
  interpolateCamera,
  matchBoundsToViewportAspect,
  panCamera,
  parseViewBox,
  reframeCameraToBounds,
  shouldAnimateSelectionCamera,
  zoomCameraAtPoint
} from "./mapGeometry";

interface WorldMapProps {
  countries: CountryRecord[];
  desktopAutoPanEnabled?: boolean;
  desktopVisibleLeftPx?: number | null;
  flashEvent: {
    countryId: CountryId;
    variant: "correct" | "wrong";
    token: number;
  } | null;
  mobileVisibleBottomPx?: number | null;
  onCountrySelect: (countryId: CountryId) => void;
  onToggleDesktopAutoPan?: () => void;
  selectedCountryId: CountryId | null;
  solvedCountryIds: CountryId[];
  viewBox: string;
}

interface GestureState {
  kind: "drag";
  pointerId: number;
  startX: number;
  startY: number;
  startViewBox: ReturnType<typeof createInitialCamera>;
}

interface PinchGestureState {
  kind: "pinch";
  pointerIds: [number, number];
  startDistance: number;
  startMidpointX: number;
  startMidpointY: number;
  startViewBox: ReturnType<typeof createInitialCamera>;
}

interface PointerSnapshot {
  clientX: number;
  clientY: number;
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
  desktopAutoPanEnabled = true,
  desktopVisibleLeftPx = null,
  flashEvent,
  mobileVisibleBottomPx = null,
  onCountrySelect,
  onToggleDesktopAutoPan,
  selectedCountryId,
  solvedCountryIds,
  viewBox
}: WorldMapProps) {
  const worldBounds = useMemo(() => parseViewBox(viewBox), [viewBox]);
  const [svgViewportMetrics, setSvgViewportMetrics] = useState(() => ({
    aspectRatio: worldBounds.width / worldBounds.height,
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0
  }));
  const [visualViewportMetrics, setVisualViewportMetrics] = useState(() => ({
    height:
      typeof window !== "undefined" && window.visualViewport
        ? window.visualViewport.height
        : 0,
    top:
      typeof window !== "undefined" && window.visualViewport
        ? window.visualViewport.offsetTop
        : 0
  }));
  const cameraBounds = useMemo(
    () =>
      matchBoundsToViewportAspect(
        expandBounds(worldBounds, SELECTION_CAMERA_PADDING),
        svgViewportMetrics.aspectRatio
      ),
    [svgViewportMetrics.aspectRatio, worldBounds]
  );
  const initialCamera = useMemo(() => createInitialCamera(cameraBounds), [cameraBounds]);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [hoveredCountryId, setHoveredCountryId] = useState<CountryId | null>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const pinchGestureRef = useRef<PinchGestureState | null>(null);
  const activePointerRef = useRef(new Map<number, PointerSnapshot>());
  const draggingRef = useRef(false);
  const flashTimeoutRef = useRef<number | null>(null);
  const flashedCountryPathRef = useRef<SVGPathElement | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationRef = useRef<CameraAnimationState | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const cameraRef = useRef<CameraState>(initialCamera);
  const previousSelectionViewportSignatureRef = useRef<string | null>(null);
  const previousSelectedCountryIdRef = useRef<CountryId | null>(null);
  const solvedCountryIdSet = useMemo(() => new Set(solvedCountryIds), [solvedCountryIds]);

  // The camera lives in refs plus direct SVG updates so dragging does not rerender
  // every country path on every pointer move.
  useEffect(() => {
    const svg = svgRef.current;

    if (!svg || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateSvgViewportMetrics = () => {
      const rect = svg.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      setSvgViewportMetrics({
        aspectRatio: rect.width / rect.height,
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right
      });
    };

    const resizeObserver = new ResizeObserver(updateSvgViewportMetrics);
    resizeObserver.observe(svg);
    updateSvgViewportMetrics();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateVisualViewportMetrics = () => {
      const viewport = window.visualViewport;

      if (!viewport) {
        setVisualViewportMetrics({
          height: window.innerHeight,
          top: 0
        });
        return;
      }

      setVisualViewportMetrics({
        height: viewport.height,
        top: viewport.offsetTop
      });
    };

    updateVisualViewportMetrics();
    window.visualViewport?.addEventListener("resize", updateVisualViewportMetrics);
    window.visualViewport?.addEventListener("scroll", updateVisualViewportMetrics);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateVisualViewportMetrics);
      window.visualViewport?.removeEventListener("scroll", updateVisualViewportMetrics);
    };
  }, []);

  useEffect(() => {
    const nextCamera =
      cameraRef.current.zoom === initialCamera.zoom &&
      cameraRef.current.width === initialCamera.width &&
      cameraRef.current.height === initialCamera.height &&
      cameraRef.current.x === initialCamera.x &&
      cameraRef.current.y === initialCamera.y
        ? initialCamera
        : reframeCameraToBounds(cameraRef.current, cameraBounds);

    cameraRef.current = nextCamera;

    if (svgRef.current) {
      svgRef.current.setAttribute("viewBox", cameraToViewBox(nextCamera));
    }
  }, [cameraBounds, initialCamera]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 960px)");
    const applyViewportMode = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    applyViewportMode();
    mediaQuery.addEventListener("change", applyViewportMode);

    return () => {
      mediaQuery.removeEventListener("change", applyViewportMode);
    };
  }, []);

  useEffect(() => {
    const clearFlashedCountry = () => {
      if (!flashedCountryPathRef.current) {
        return;
      }

      flashedCountryPathRef.current.classList.remove("world-map__country--flash");
      flashedCountryPathRef.current.classList.remove(
        "world-map__country--flash-correct"
      );
      flashedCountryPathRef.current.classList.remove(
        "world-map__country--flash-wrong"
      );
      flashedCountryPathRef.current = null;
    };

    return () => {
      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
      }

      clearFlashedCountry();

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

      const progress = Math.min(1, (now - animation.startAt) / 500);
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
    const clearFlashedCountry = () => {
      if (!flashedCountryPathRef.current) {
        return;
      }

      flashedCountryPathRef.current.classList.remove("world-map__country--flash");
      flashedCountryPathRef.current.classList.remove(
        "world-map__country--flash-correct"
      );
      flashedCountryPathRef.current.classList.remove(
        "world-map__country--flash-wrong"
      );
      flashedCountryPathRef.current = null;
    };
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

    if (flashTimeoutRef.current !== null) {
      window.clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }

    clearFlashedCountry();
    void countryPath.getBoundingClientRect();
    countryPath.classList.add("world-map__country--flash");
    countryPath.classList.add(
      variant === "correct"
        ? "world-map__country--flash-correct"
        : "world-map__country--flash-wrong"
    );
    flashedCountryPathRef.current = countryPath;

    flashTimeoutRef.current = window.setTimeout(() => {
      clearFlashedCountry();
      flashTimeoutRef.current = null;
    }, 320);
  };

  useEffect(() => {
    if (!flashEvent) {
      return;
    }

    flashCountry(flashEvent.countryId, flashEvent.variant);
  }, [flashEvent]);

  const selectionViewportRect = useMemo<SelectionViewportRect>(() => {
    if (svgViewportMetrics.height <= 0) {
      return DESKTOP_SELECTION_VIEWPORT;
    }

    if (!isMobileViewport) {
      if (desktopVisibleLeftPx === null) {
        return DESKTOP_SELECTION_VIEWPORT;
      }

      return {
        leftRatio: Math.min(
          0.95,
          Math.max(
            0,
            (Math.min(desktopVisibleLeftPx, svgViewportMetrics.right) - svgViewportMetrics.left) /
              (svgViewportMetrics.right - svgViewportMetrics.left || 1)
          )
        ),
        rightRatio: 1,
        topRatio: 0,
        bottomRatio: 1
      };
    }

    const visualViewportBottom =
      visualViewportMetrics.top + visualViewportMetrics.height;
    const visibleTop = Math.max(svgViewportMetrics.top, visualViewportMetrics.top);
    const visibleBottom = Math.min(
      svgViewportMetrics.bottom,
      mobileVisibleBottomPx ?? visualViewportBottom,
      visualViewportBottom
    );
    const visibleHeight = Math.max(1, visibleBottom - visibleTop);

    return {
      leftRatio: 0,
      rightRatio: 1,
      topRatio: Math.min(
        1,
        Math.max(0, (visibleTop - svgViewportMetrics.top) / svgViewportMetrics.height)
      ),
      bottomRatio: Math.min(
        1,
        Math.max(
          0.2,
          (visibleTop - svgViewportMetrics.top + visibleHeight) / svgViewportMetrics.height
        )
      )
    };
  }, [
    desktopVisibleLeftPx,
    isMobileViewport,
    mobileVisibleBottomPx,
    svgViewportMetrics.bottom,
    svgViewportMetrics.height,
    svgViewportMetrics.left,
    svgViewportMetrics.right,
    svgViewportMetrics.top,
    visualViewportMetrics.height,
    visualViewportMetrics.top
  ]);

  useEffect(() => {
    if (!selectedCountryId) {
      previousSelectionViewportSignatureRef.current = null;
      previousSelectedCountryIdRef.current = null;
      return;
    }

    // A recenter should happen when either the selected country changes or the
    // visible mobile map area changes enough to matter, such as when the keyboard
    // opens and pushes the HUD upward.
    const selectionViewportSignature = [
      selectedCountryId,
      isMobileViewport ? "mobile" : "desktop",
      Math.round(selectionViewportRect.leftRatio * 1000),
      Math.round(selectionViewportRect.topRatio * 1000),
      Math.round(selectionViewportRect.rightRatio * 1000),
      Math.round(selectionViewportRect.bottomRatio * 1000)
    ].join(":");

    if (
      previousSelectionViewportSignatureRef.current ===
      selectionViewportSignature
    ) {
      return;
    }

    const countryChanged = selectedCountryId !== previousSelectedCountryIdRef.current;
    previousSelectionViewportSignatureRef.current = selectionViewportSignature;
    previousSelectedCountryIdRef.current = selectedCountryId;

    const selectedCountry = countries.find((country) => country.id === selectedCountryId);

    if (!selectedCountry) {
      return;
    }

    const targetCamera = getSelectionTargetCamera(
      cameraRef.current,
      cameraBounds,
      selectedCountry,
      isMobileViewport,
      selectionViewportRect
    );
    const effectiveTargetCamera =
      !isMobileViewport && !desktopAutoPanEnabled ? cameraRef.current : targetCamera;

    // On mobile, always animate when the country itself changes. The
    // shouldAnimateSelectionCamera guard can still suppress redundant moves when
    // only the keyboard/dock ratio shifts slightly.
    if (
      !(isMobileViewport && countryChanged) &&
      !shouldAnimateSelectionCamera(
        cameraRef.current,
        effectiveTargetCamera,
        worldBounds,
        selectedCountry
      )
    ) {
      return;
    }

    animateCameraUpdate(effectiveTargetCamera);
  }, [
    cameraBounds,
    countries,
    desktopAutoPanEnabled,
    isMobileViewport,
    selectionViewportRect,
    selectedCountryId,
    worldBounds
  ]);

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.pointerType !== "touch") {
      return;
    }

    activePointerRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });
    setHoveredCountryId(getCountryIdFromTarget(event.target));
    setIsDragging(false);

    if ("setPointerCapture" in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    if (event.pointerType === "touch" && activePointerRef.current.size >= 2) {
      const [firstPointer, secondPointer] = Array.from(
        activePointerRef.current.entries()
      ).slice(0, 2);

      stopCameraAnimation();
      gestureRef.current = null;
      pinchGestureRef.current = {
        kind: "pinch",
        pointerIds: [firstPointer[0], secondPointer[0]],
        startDistance: Math.max(
          Math.hypot(
            secondPointer[1].clientX - firstPointer[1].clientX,
            secondPointer[1].clientY - firstPointer[1].clientY
          ),
          1
        ),
        startMidpointX: (firstPointer[1].clientX + secondPointer[1].clientX) / 2,
        startMidpointY: (firstPointer[1].clientY + secondPointer[1].clientY) / 2,
        startViewBox: cameraRef.current
      };
      draggingRef.current = true;
      setIsDragging(true);
      setHoveredCountryId(null);
      return;
    }

    pinchGestureRef.current = null;
    draggingRef.current = false;
    gestureRef.current = {
      kind: "drag",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startViewBox: cameraRef.current
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    activePointerRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY
    });

    const pinchGesture = pinchGestureRef.current;

    if (pinchGesture && pinchGesture.pointerIds.includes(event.pointerId)) {
      const firstPointer = activePointerRef.current.get(pinchGesture.pointerIds[0]);
      const secondPointer = activePointerRef.current.get(pinchGesture.pointerIds[1]);

      if (!firstPointer || !secondPointer) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const startFocusRatioX =
        (pinchGesture.startMidpointX - rect.left) / rect.width;
      const startFocusRatioY =
        (pinchGesture.startMidpointY - rect.top) / rect.height;
      const focalX =
        pinchGesture.startViewBox.x +
        startFocusRatioX * pinchGesture.startViewBox.width;
      const focalY =
        pinchGesture.startViewBox.y +
        startFocusRatioY * pinchGesture.startViewBox.height;
      const nextDistance = Math.max(
        Math.hypot(
          secondPointer.clientX - firstPointer.clientX,
          secondPointer.clientY - firstPointer.clientY
        ),
        1
      );
      const nextZoom =
        pinchGesture.startViewBox.zoom *
        (nextDistance / pinchGesture.startDistance);
      const zoomedCamera = zoomCameraAtPoint(
        pinchGesture.startViewBox,
        cameraBounds,
        nextZoom,
        startFocusRatioX,
        startFocusRatioY
      );
      const midpointX = (firstPointer.clientX + secondPointer.clientX) / 2;
      const midpointY = (firstPointer.clientY + secondPointer.clientY) / 2;
      const focusRatioX = (midpointX - rect.left) / rect.width;
      const focusRatioY = (midpointY - rect.top) / rect.height;

      renderCamera(
        clampCamera(
          {
            ...zoomedCamera,
            x: focalX - focusRatioX * zoomedCamera.width,
            y: focalY - focusRatioY * zoomedCamera.height
          },
          cameraBounds
        )
      );
      return;
    }

    const gesture = gestureRef.current;

    if (!gesture) {
      setHoveredCountryId(getCountryIdFromTarget(event.target));
      return;
    }

    if (gesture.pointerId !== event.pointerId) {
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
    const pinchGesture = pinchGestureRef.current;
    const releasedPointer = activePointerRef.current.get(event.pointerId);

    activePointerRef.current.delete(event.pointerId);

    if (
      gesture &&
      gesture.pointerId === event.pointerId &&
      !draggingRef.current
    ) {
      const countryId =
        getCountryIdFromPoint(event.clientX, event.clientY) ??
        getCountryIdFromTarget(event.target);

      if (
        countryId &&
        !solvedCountryIdSet.has(countryId) &&
        !(isMobileViewport && event.pointerType === "touch")
      ) {
        onCountrySelect(countryId);
      }
    }

    if (pinchGesture && pinchGesture.pointerIds.includes(event.pointerId)) {
      pinchGestureRef.current = null;

      const remainingPointer = Array.from(activePointerRef.current.entries())[0];

      if (remainingPointer) {
        gestureRef.current = {
          kind: "drag",
          pointerId: remainingPointer[0],
          startX: remainingPointer[1].clientX,
          startY: remainingPointer[1].clientY,
          startViewBox: cameraRef.current
        };
      } else {
        gestureRef.current = null;
      }

      draggingRef.current = false;
      setIsDragging(false);
    } else if (gesture && gesture.pointerId === event.pointerId) {
      gestureRef.current = null;
      draggingRef.current = false;
      setIsDragging(false);
    }

    if (!releasedPointer && activePointerRef.current.size === 0) {
      setIsDragging(false);
      draggingRef.current = false;
      gestureRef.current = null;
      pinchGestureRef.current = null;
    }

    if ("releasePointerCapture" in event.currentTarget) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleCountryClick = (
    event: React.MouseEvent<SVGPathElement>,
    countryId: CountryId
  ) => {
    event.preventDefault();

    if (
      !isMobileViewport ||
      draggingRef.current ||
      solvedCountryIdSet.has(countryId)
    ) {
      return;
    }

    if (typeof event.currentTarget.blur === "function") {
      event.currentTarget.blur();
    }

    onCountrySelect(countryId);
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
          <label className="map-controls__toggle" htmlFor="desktop-auto-pan">
            <span>Auto-pan</span>
            <input
              checked={desktopAutoPanEnabled}
              id="desktop-auto-pan"
              type="checkbox"
              onChange={() => {
                onToggleDesktopAutoPan?.();
              }}
            />
          </label>
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
          onPointerCancel={handlePointerUp}
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
                onClick={(event) => handleCountryClick(event, country.id)}
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
