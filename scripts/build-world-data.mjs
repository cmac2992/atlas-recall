import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import world from "@svg-maps/world";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, "../src/data/countries.world.json");

const EXCLUDED_IDS = new Set([
  "ai",
  "as",
  "aw",
  "ax",
  "bl",
  "bm",
  "bq",
  "bv",
  "cc",
  "ck",
  "cw",
  "cx",
  "eh",
  "fk",
  "fo",
  "gf",
  "gg",
  "gi",
  "gl",
  "go",
  "gp",
  "gs",
  "gu",
  "hk",
  "hm",
  "im",
  "io",
  "je",
  "ju",
  "ky",
  "mf",
  "mo",
  "mp",
  "mq",
  "ms",
  "nc",
  "nf",
  "nu",
  "pf",
  "pm",
  "pn",
  "pr",
  "re",
  "sh",
  "sj",
  "sx",
  "tc",
  "tf",
  "tk",
  "um-dq",
  "um-fq",
  "um-hq",
  "um-jq",
  "um-mq",
  "um-wq",
  "vg",
  "vi",
  "wf",
  "yt"
]);

const NAME_OVERRIDES = {
  bn: "Brunei",
  bo: "Bolivia",
  ci: "Cote d'Ivoire",
  cv: "Cabo Verde",
  cz: "Czechia",
  fm: "Micronesia",
  kp: "North Korea",
  kr: "South Korea",
  la: "Laos",
  mk: "North Macedonia",
  ps: "Palestine",
  sd: "Sudan",
  ss: "South Sudan",
  st: "Sao Tome and Principe",
  sz: "Eswatini",
  tl: "Timor-Leste",
  us: "United States",
  va: "Vatican City",
  ve: "Venezuela",
  vn: "Vietnam"
};

function isCommand(token) {
  return /^[A-Za-z]$/.test(token);
}

function toNumber(token) {
  return Number(token);
}

function computePathData(pathData) {
  const tokens = pathData.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  let index = 0;
  let command = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const includePoint = (pointX, pointY) => {
    minX = Math.min(minX, pointX);
    minY = Math.min(minY, pointY);
    maxX = Math.max(maxX, pointX);
    maxY = Math.max(maxY, pointY);
  };

  const hasNumbers = () => index < tokens.length && !isCommand(tokens[index]);

  const nextNumber = () => toNumber(tokens[index++]);

  while (index < tokens.length) {
    if (isCommand(tokens[index])) {
      command = tokens[index++];
    }

    switch (command) {
      case "M":
      case "L":
      case "T":
        while (hasNumbers()) {
          x = nextNumber();
          y = nextNumber();
          includePoint(x, y);

          if (command === "M") {
            startX = x;
            startY = y;
            command = "L";
          }
        }
        break;
      case "m":
      case "l":
      case "t":
        while (hasNumbers()) {
          x += nextNumber();
          y += nextNumber();
          includePoint(x, y);

          if (command === "m") {
            startX = x;
            startY = y;
            command = "l";
          }
        }
        break;
      case "H":
        while (hasNumbers()) {
          x = nextNumber();
          includePoint(x, y);
        }
        break;
      case "h":
        while (hasNumbers()) {
          x += nextNumber();
          includePoint(x, y);
        }
        break;
      case "V":
        while (hasNumbers()) {
          y = nextNumber();
          includePoint(x, y);
        }
        break;
      case "v":
        while (hasNumbers()) {
          y += nextNumber();
          includePoint(x, y);
        }
        break;
      case "C":
        while (hasNumbers()) {
          const x1 = nextNumber();
          const y1 = nextNumber();
          const x2 = nextNumber();
          const y2 = nextNumber();
          x = nextNumber();
          y = nextNumber();
          includePoint(x1, y1);
          includePoint(x2, y2);
          includePoint(x, y);
        }
        break;
      case "c":
        while (hasNumbers()) {
          const x1 = x + nextNumber();
          const y1 = y + nextNumber();
          const x2 = x + nextNumber();
          const y2 = y + nextNumber();
          x += nextNumber();
          y += nextNumber();
          includePoint(x1, y1);
          includePoint(x2, y2);
          includePoint(x, y);
        }
        break;
      case "S":
      case "Q":
        while (hasNumbers()) {
          const x1 = nextNumber();
          const y1 = nextNumber();
          const x2 = nextNumber();
          const y2 = nextNumber();
          x = x2;
          y = y2;
          includePoint(x1, y1);
          includePoint(x2, y2);
        }
        break;
      case "s":
      case "q":
        while (hasNumbers()) {
          const x1 = x + nextNumber();
          const y1 = y + nextNumber();
          x += nextNumber();
          y += nextNumber();
          includePoint(x1, y1);
          includePoint(x, y);
        }
        break;
      case "A":
        while (hasNumbers()) {
          const rx = nextNumber();
          const ry = nextNumber();
          index += 3;
          x = nextNumber();
          y = nextNumber();
          includePoint(x, y);
          includePoint(x + rx, y + ry);
          includePoint(x - rx, y - ry);
        }
        break;
      case "a":
        while (hasNumbers()) {
          const rx = nextNumber();
          const ry = nextNumber();
          index += 3;
          x += nextNumber();
          y += nextNumber();
          includePoint(x, y);
          includePoint(x + rx, y + ry);
          includePoint(x - rx, y - ry);
        }
        break;
      case "Z":
      case "z":
        x = startX;
        y = startY;
        includePoint(x, y);
        break;
      default:
        break;
    }
  }

  if (!Number.isFinite(minX)) {
    return {
      bbox: [0, 0, 0, 0],
      centroid: [0, 0]
    };
  }

  return {
    bbox: [minX, minY, maxX, maxY],
    centroid: [(minX + maxX) / 2, (minY + maxY) / 2]
  };
}

const intermediateCountries = world.locations
  .filter((location) => !EXCLUDED_IDS.has(location.id))
  .map((location) => {
    const { bbox, centroid } = computePathData(location.path);

    return {
      id: location.id,
      displayName: NAME_OVERRIDES[location.id] ?? location.name.replace(/\s{2,}/g, " "),
      svgPath: location.path,
      centroid,
      bbox
    };
  });

const countries = intermediateCountries
  .map((country) => ({
    id: country.id,
    displayName: country.displayName,
    svgPath: country.svgPath,
    centroid: country.centroid,
    bbox: country.bbox
  }))
  .sort((left, right) => left.displayName.localeCompare(right.displayName));

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(
  outputPath,
  `${JSON.stringify(
    {
      label: world.label,
      viewBox: world.viewBox,
      countries
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${countries.length} countries to ${outputPath}`);
