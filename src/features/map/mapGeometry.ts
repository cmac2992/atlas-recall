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
export const MAX_CAMERA_ZOOM = 14;
export const SELECTION_CAMERA_PADDING = {
  left: 0.42,
  right: 0.24,
  top: 0.18,
  bottom: 0.2
} as const;

// The left HUD permanently covers part of the SVG, so our "usable" map area starts
// a little to the right of the actual left edge.
const HUD_LEFT_RATIO = 0.24;
const VISIBLE_LEFT_RATIO = HUD_LEFT_RATIO;
const VISIBLE_RIGHT_RATIO = 1;
const VISIBLE_WIDTH_RATIO = VISIBLE_RIGHT_RATIO - VISIBLE_LEFT_RATIO;
const VISIBLE_CENTER_X_RATIO = (VISIBLE_LEFT_RATIO + VISIBLE_RIGHT_RATIO) / 2;
const VISIBLE_CENTER_Y_RATIO = 0.5;

// Selected countries should land around 25% of the usable viewport. We compare
// width and height separately and keep the farther zoom-out so the whole country fits.
const TARGET_COUNTRY_COVERAGE = 0.25;

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

function getSuggestedSelectionZoom(camera: CameraState, country: CountryRecord) {
  const [minX, minY, maxX, maxY] = country.bbox;
  const countryWidth = maxX - minX;
  const countryHeight = maxY - minY;
  const currentWidthCoverage = countryWidth / (camera.width * VISIBLE_WIDTH_RATIO);
  const currentHeightCoverage = countryHeight / camera.height;
  const horizontalZoomTarget =
    camera.zoom * (TARGET_COUNTRY_COVERAGE / currentWidthCoverage);
  const verticalZoomTarget =
    camera.zoom * (TARGET_COUNTRY_COVERAGE / currentHeightCoverage);
  return Math.min(
    MAX_CAMERA_ZOOM,
    Math.max(MIN_CAMERA_ZOOM, Math.min(horizontalZoomTarget, verticalZoomTarget))
  );
}

function positionCameraForCountry(
  bounds: ViewBoxBounds,
  country: CountryRecord,
  nextZoom: number
): CameraState {
  const [minX, minY, maxX, maxY] = country.bbox;
  const nextWidth = bounds.width / nextZoom;
  const nextHeight = bounds.height / nextZoom;
  const countryCenterX = (minX + maxX) / 2;
  const countryCenterY = (minY + maxY) / 2;
  const targetX = countryCenterX - nextWidth * VISIBLE_CENTER_X_RATIO;
  const targetY = countryCenterY - nextHeight * VISIBLE_CENTER_Y_RATIO;

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
  country: CountryRecord
) {
  return positionCameraForCountry(bounds, country, getSuggestedSelectionZoom(camera, country));
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
