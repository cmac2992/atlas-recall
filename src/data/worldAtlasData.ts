import rawAtlasData from "./countries.world.json";
import type { WorldMapData } from "../features/game/gameTypes";

// JSON imports widen tuple values like `[x, y]` into plain `number[]`.
// We normalize once here so the rest of the app can work with the stronger,
// easier-to-understand `WorldMapData` shape directly.
export const worldAtlasData: WorldMapData = {
  label: rawAtlasData.label,
  viewBox: rawAtlasData.viewBox,
  countries: rawAtlasData.countries.map((country) => ({
    id: country.id,
    displayName: country.displayName,
    svgPath: country.svgPath,
    centroid: [country.centroid[0], country.centroid[1]],
    bbox: [country.bbox[0], country.bbox[1], country.bbox[2], country.bbox[3]]
  }))
};
