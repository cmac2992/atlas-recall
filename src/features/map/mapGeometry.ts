import type { CountryRecord } from "../game/gameTypes";

export interface ViewBoxBounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

interface BoundsPadding {
  bottom?: number;
  left?: number;
  right?: number;
  top?: number;
}

export interface CameraState {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export const MIN_CAMERA_ZOOM = 1;
export const MAX_CAMERA_ZOOM = 60;
export const SELECTION_CAMERA_PADDING = {
  left: 0.42,
  right: 0.24,
  top: 0.18,
  bottom: 0.2
} as const;

// Desktop has much more room, so selected countries can sit in the frame more
// loosely without feeling hard to find.
const TARGET_COUNTRY_COVERAGE = 0.18;

// On mobile the screen is smaller and the visible area is further reduced by the
// keyboard and search dock. A higher target keeps countries legible, and Math.min
// (rather than Math.max) ensures the full bounding box fits in the visible area.
const MOBILE_TARGET_COUNTRY_COVERAGE = 0.3;

export interface SelectionViewportRect {
  leftRatio: number;
  rightRatio: number;
  topRatio: number;
  bottomRatio: number;
}

export const DESKTOP_SELECTION_VIEWPORT: SelectionViewportRect = {
  leftRatio: 0.24,
  rightRatio: 1,
  topRatio: 0,
  bottomRatio: 1
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function parseViewBox(viewBox: string): ViewBoxBounds {
  const [minX, minY, width, height] = viewBox.split(/\s+/).map(Number);

  if ([minX, minY, width, height].some((value) => Number.isNaN(value))) {
    throw new Error(`Invalid viewBox: ${viewBox}`);
  }

  return { minX, minY, width, height };
}

// The map data gives us the "true" world bounds. We expand them with extra ocean
// so the HUD can cover part of the screen without hiding land at max zoom-out.
export function expandBounds(
  bounds: ViewBoxBounds,
  padding: BoundsPadding
): ViewBoxBounds {
  const left = bounds.width * (padding.left ?? 0);
  const right = bounds.width * (padding.right ?? 0);
  const top = bounds.height * (padding.top ?? 0);
  const bottom = bounds.height * (padding.bottom ?? 0);

  return {
    minX: bounds.minX - left,
    minY: bounds.minY - top,
    width: bounds.width + left + right,
    height: bounds.height + top + bottom
  };
}

// The SVG viewBox needs to match the viewport aspect ratio, otherwise portrait
// screens end up letterboxing a wide world camera and all centering math feels off.
export function matchBoundsToViewportAspect(
  bounds: ViewBoxBounds,
  viewportAspectRatio: number
): ViewBoxBounds {
  const safeAspectRatio = Math.max(0.1, viewportAspectRatio);
  const currentAspectRatio = bounds.width / bounds.height;

  if (Math.abs(currentAspectRatio - safeAspectRatio) < 0.001) {
    return bounds;
  }

  if (currentAspectRatio > safeAspectRatio) {
    const nextHeight = bounds.width / safeAspectRatio;
    const extraHeight = nextHeight - bounds.height;

    return {
      ...bounds,
      minY: bounds.minY - extraHeight / 2,
      height: nextHeight
    };
  }

  const nextWidth = bounds.height * safeAspectRatio;
  const extraWidth = nextWidth - bounds.width;

  return {
    ...bounds,
    minX: bounds.minX - extraWidth / 2,
    width: nextWidth
  };
}

// A camera is just the visible rectangle of the world.
export function createInitialCamera(bounds: ViewBoxBounds): CameraState {
  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.width,
    height: bounds.height,
    zoom: 1
  };
}

export function reframeCameraToBounds(
  camera: CameraState,
  bounds: ViewBoxBounds
): CameraState {
  const currentCenter = {
    x: camera.x + camera.width / 2,
    y: camera.y + camera.height / 2
  };
  const nextWidth = bounds.width / camera.zoom;
  const nextHeight = bounds.height / camera.zoom;

  return clampCamera(
    {
      x: currentCenter.x - nextWidth / 2,
      y: currentCenter.y - nextHeight / 2,
      width: nextWidth,
      height: nextHeight,
      zoom: camera.zoom
    },
    bounds
  );
}

// Keep the camera inside the padded world bounds so panning and zooming never
// reveal empty space beyond the extra ocean margin we intentionally allow.
export function clampCamera(camera: CameraState, bounds: ViewBoxBounds): CameraState {
  const maxX = bounds.minX + bounds.width - camera.width;
  const maxY = bounds.minY + bounds.height - camera.height;

  return {
    ...camera,
    x: clamp(camera.x, bounds.minX, maxX),
    y: clamp(camera.y, bounds.minY, maxY)
  };
}

// Panning means "move the visible rectangle" and clamp the result.
export function panCamera(
  camera: CameraState,
  bounds: ViewBoxBounds,
  deltaX: number,
  deltaY: number
) {
  return clampCamera(
    {
      ...camera,
      x: camera.x + deltaX,
      y: camera.y + deltaY
    },
    bounds
  );
}

// Zoom around a focal point so wheel zoom feels like it is moving toward the cursor
// instead of always zooming toward the center of the map.
export function zoomCameraAtPoint(
  camera: CameraState,
  bounds: ViewBoxBounds,
  nextZoom: number,
  focusRatioX: number,
  focusRatioY: number
) {
  const clampedZoom = clamp(nextZoom, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
  const nextWidth = bounds.width / clampedZoom;
  const nextHeight = bounds.height / clampedZoom;
  const focalX = camera.x + focusRatioX * camera.width;
  const focalY = camera.y + focusRatioY * camera.height;

  return clampCamera(
    {
      x: focalX - focusRatioX * nextWidth,
      y: focalY - focusRatioY * nextHeight,
      width: nextWidth,
      height: nextHeight,
      zoom: clampedZoom
    },
    bounds
  );
}

export function cameraToViewBox(camera: CameraState) {
  return `${camera.x} ${camera.y} ${camera.width} ${camera.height}`;
}

interface CameraCenter {
  x: number;
  y: number;
}

function getCameraCenter(camera: CameraState): CameraCenter {
  return {
    x: camera.x + camera.width / 2,
    y: camera.y + camera.height / 2
  };
}

function createCameraFromCenterZoom(
  center: CameraCenter,
  zoom: number,
  bounds: ViewBoxBounds
) {
  const clampedZoom = Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, zoom));
  const width = bounds.width / clampedZoom;
  const height = bounds.height / clampedZoom;

  return clampCamera(
    {
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
      zoom: clampedZoom
    },
    bounds
  );
}

export function zoomCameraAroundCurrentCenter(
  camera: CameraState,
  bounds: ViewBoxBounds,
  nextZoom: number
) {
  return createCameraFromCenterZoom(getCameraCenter(camera), nextZoom, bounds);
}

function clampViewportRect(viewportRect: SelectionViewportRect): SelectionViewportRect {
  const leftRatio = clamp(viewportRect.leftRatio, 0, 0.95);
  const rightRatio = clamp(viewportRect.rightRatio, leftRatio + 0.05, 1);
  const topRatio = clamp(viewportRect.topRatio, 0, 0.95);
  const bottomRatio = clamp(viewportRect.bottomRatio, topRatio + 0.05, 1);

  return {
    leftRatio,
    rightRatio,
    topRatio,
    bottomRatio
  };
}

function getSuggestedSelectionZoom(
  camera: CameraState,
  country: CountryRecord,
  viewportRect: SelectionViewportRect,
  isMobileViewport: boolean
) {
  const [minX, minY, maxX, maxY] = country.bbox;
  const countryWidth = maxX - minX;
  const countryHeight = maxY - minY;
  const visibleWidthRatio = viewportRect.rightRatio - viewportRect.leftRatio;
  const visibleHeightRatio = viewportRect.bottomRatio - viewportRect.topRatio;
  const currentWidthCoverage = countryWidth / (camera.width * visibleWidthRatio);
  const currentHeightCoverage = countryHeight / (camera.height * visibleHeightRatio);
  const horizontalZoomTarget =
    camera.zoom * (TARGET_COUNTRY_COVERAGE / currentWidthCoverage);
  const verticalZoomTarget =
    camera.zoom * (TARGET_COUNTRY_COVERAGE / currentHeightCoverage);
  if (isMobileViewport) {
    // Math.min ensures the full country bbox fits in the visible area above the
    // dock/keyboard. Math.max (old behaviour) could zoom past what fits vertically
    // for tall narrow countries like Norway or Chile.
    const mobileCoverage = MOBILE_TARGET_COUNTRY_COVERAGE;
    const mobileHTarget = camera.zoom * (mobileCoverage / currentWidthCoverage);
    const mobileVTarget = camera.zoom * (mobileCoverage / currentHeightCoverage);
    return clamp(Math.min(mobileHTarget, mobileVTarget), MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
  }

  const preferredZoomTarget = Math.min(horizontalZoomTarget, verticalZoomTarget);

  return Math.min(
    MAX_CAMERA_ZOOM,
    Math.max(MIN_CAMERA_ZOOM, preferredZoomTarget)
  );
}

function positionCameraForCountry(
  bounds: ViewBoxBounds,
  country: CountryRecord,
  nextZoom: number,
  viewportRect: SelectionViewportRect
): CameraState {
  const [minX, minY, maxX, maxY] = country.bbox;
  const nextWidth = bounds.width / nextZoom;
  const nextHeight = bounds.height / nextZoom;
  const countryCenterX = (minX + maxX) / 2;
  const countryCenterY = (minY + maxY) / 2;
  const centerXRatio = (viewportRect.leftRatio + viewportRect.rightRatio) / 2;
  const centerYRatio = (viewportRect.topRatio + viewportRect.bottomRatio) / 2;
  const targetX = countryCenterX - nextWidth * centerXRatio;
  const targetY = countryCenterY - nextHeight * centerYRatio;

  return clampCamera(
    {
      x: targetX,
      y: targetY,
      width: nextWidth,
      height: nextHeight,
      zoom: nextZoom
    },
    bounds
  );
}

export function getSelectionTargetCamera(
  camera: CameraState,
  bounds: ViewBoxBounds,
  country: CountryRecord,
  isMobileViewport: boolean,
  viewportRect?: SelectionViewportRect
) {
  const effectiveViewportRect = clampViewportRect(
    viewportRect ?? DESKTOP_SELECTION_VIEWPORT
  );

  return positionCameraForCountry(
    bounds,
    country,
    getSuggestedSelectionZoom(camera, country, effectiveViewportRect, isMobileViewport),
    effectiveViewportRect
  );
}

function areCountryAndCameraNearWorldEdge(
  camera: CameraState,
  bounds: ViewBoxBounds,
  country: CountryRecord
) {
  const [minX, minY, maxX, maxY] = country.bbox;
  const cameraRight = camera.x + camera.width;
  const cameraBottom = camera.y + camera.height;
  const boundsRight = bounds.minX + bounds.width;
  const boundsBottom = bounds.minY + bounds.height;

  return {
    countryTouchesHorizontalEdge:
      minX <= bounds.minX + 1 || maxX >= boundsRight - 1,
    countryTouchesVerticalEdge:
      minY <= bounds.minY + 1 || maxY >= boundsBottom - 1,
    cameraTouchesHorizontalEdge:
      camera.x <= bounds.minX + 0.5 || cameraRight >= boundsRight - 0.5,
    cameraTouchesVerticalEdge:
      camera.y <= bounds.minY + 0.5 || cameraBottom >= boundsBottom - 0.5
  };
}

export function areCameraStatesClose(left: CameraState, right: CameraState) {
  return (
    Math.abs(left.x - right.x) < 0.35 &&
    Math.abs(left.y - right.y) < 0.35 &&
    Math.abs(left.width - right.width) < 0.35 &&
    Math.abs(left.height - right.height) < 0.35 &&
    Math.abs(left.zoom - right.zoom) < 0.02
  );
}

export function shouldAnimateSelectionCamera(
  currentCamera: CameraState,
  targetCamera: CameraState,
  worldBounds: ViewBoxBounds,
  country: CountryRecord
) {
  const edgeState = areCountryAndCameraNearWorldEdge(
    targetCamera,
    worldBounds,
    country
  );

  if (!areCameraStatesClose(currentCamera, targetCamera)) {
    return true;
  }

  return (
    (edgeState.countryTouchesHorizontalEdge && edgeState.cameraTouchesHorizontalEdge) ||
    (edgeState.countryTouchesVerticalEdge && edgeState.cameraTouchesVerticalEdge)
  );
}

export function interpolateCamera(
  from: CameraState,
  target: CameraState,
  progress: number,
  bounds: ViewBoxBounds
): CameraState {
  const fromCenter = getCameraCenter(from);
  const targetCenter = getCameraCenter(target);
  const nextCenter = {
    x: fromCenter.x + (targetCenter.x - fromCenter.x) * progress,
    y: fromCenter.y + (targetCenter.y - fromCenter.y) * progress
  };
  const nextZoom = from.zoom + (target.zoom - from.zoom) * progress;

  return createCameraFromCenterZoom(nextCenter, nextZoom, bounds);
}
