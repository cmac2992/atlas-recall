import type { CountryId, CountryRecord, GameSession } from "./gameTypes";

export interface SelectionHistoryState {
  items: CountryId[];
  index: number;
}

// We keep manual navigation history outside the reducer because it is a UI concern:
// it helps Prev/Next browsing, but it does not change scoring rules.
export const EMPTY_BROWSE_HISTORY: SelectionHistoryState = {
  items: [],
  index: -1
};

// Recent countries are used as a soft "do not bounce back here immediately" list.
// We walk backward so the newest visits win when the same country appears twice.
export function getRecentVisitedCountryIds(
  browseHistory: SelectionHistoryState,
  currentCountryId: CountryId | null,
  memory = 10
) {
  const countryIds = currentCountryId
    ? [...browseHistory.items.slice(0, browseHistory.index + 1), currentCountryId]
    : browseHistory.items.slice(0, browseHistory.index + 1);
  const recentCountryIds: CountryId[] = [];
  const seenCountryIds = new Set<CountryId>();

  for (let index = countryIds.length - 1; index >= 0; index -= 1) {
    const countryId = countryIds[index];

    if (seenCountryIds.has(countryId)) {
      continue;
    }

    seenCountryIds.add(countryId);
    recentCountryIds.push(countryId);

    if (recentCountryIds.length >= memory) {
      break;
    }
  }

  return recentCountryIds;
}

// Moving backward through history should not create a duplicate history entry.
// This keeps Left/Right navigation acting like browser history.
export function recordVisitedCountry(
  browseHistory: SelectionHistoryState,
  selectedCountryId: CountryId,
  navigatingCountryId: CountryId | null
): SelectionHistoryState {
  if (navigatingCountryId === selectedCountryId) {
    return browseHistory;
  }

  const truncatedItems = browseHistory.items.slice(0, browseHistory.index + 1);

  if (truncatedItems[truncatedItems.length - 1] === selectedCountryId) {
    return {
      items: truncatedItems,
      index: truncatedItems.length - 1
    };
  }

  return {
    items: [...truncatedItems, selectedCountryId],
    index: truncatedItems.length
  };
}

// "Previous" should only land on countries the player can still work on.
export function getPreviousOpenCountry(
  browseHistory: SelectionHistoryState,
  answered: GameSession["answered"]
) {
  for (let historyIndex = browseHistory.index - 1; historyIndex >= 0; historyIndex -= 1) {
    const countryId = browseHistory.items[historyIndex];

    if (!answered[countryId]?.correct) {
      return {
        countryId,
        historyIndex
      };
    }
  }

  return null;
}

function getCentroidDistance(left: CountryRecord, right: CountryRecord) {
  return Math.hypot(left.centroid[0] - right.centroid[0], left.centroid[1] - right.centroid[1]);
}

export function getFirstUnsolvedCountryId(
  countries: CountryRecord[],
  answered: GameSession["answered"],
  excludedCountryIds: Iterable<CountryId> = []
) {
  const blockedCountryIds = new Set(excludedCountryIds);

  return (
    countries.find(
      (country) => !blockedCountryIds.has(country.id) && !answered[country.id]?.correct
    )?.id ?? null
  );
}

function getBlockedCountryIds(
  answered: GameSession["answered"],
  excludedCountryIds: Iterable<CountryId> = []
) {
  const blockedCountryIds = new Set(
    Object.entries(answered)
      .filter(([, answer]) => answer.correct)
      .map(([countryId]) => countryId)
  );

  for (const countryId of excludedCountryIds) {
    blockedCountryIds.add(countryId);
  }

  return blockedCountryIds;
}

// "Nearby" now means centroid distance only. This is simpler than maintaining
// a precomputed border graph and is good enough for the current game feel.
function getNearestCountryId(
  countries: CountryRecord[],
  originCountryId: CountryId,
  answered: GameSession["answered"],
  excludedCountryIds: Iterable<CountryId> = []
) {
  const originCountry = countries.find((country) => country.id === originCountryId);

  if (!originCountry) {
    return null;
  }

  const blockedCountryIds = getBlockedCountryIds(answered, excludedCountryIds);
  blockedCountryIds.add(originCountryId);

  return countries
    .filter((country) => !blockedCountryIds.has(country.id))
    .sort(
      (leftCountry, rightCountry) =>
        getCentroidDistance(originCountry, leftCountry) -
          getCentroidDistance(originCountry, rightCountry) ||
        leftCountry.displayName.localeCompare(rightCountry.displayName)
    )[0]?.id ?? null;
}

// Next still tries to stay geographically local, but "local" is now based on
// straight-line centroid distance instead of true land borders.
export function getNextNearbyCountryId(
  countries: CountryRecord[],
  originCountryId: CountryId | null,
  answered: GameSession["answered"],
  recentCountryIds: CountryId[] = []
) {
  const excludedCountryIds = recentCountryIds.filter(
    (countryId) => countryId !== originCountryId
  );

  if (!originCountryId) {
    return (
      getFirstUnsolvedCountryId(countries, answered, excludedCountryIds) ??
      getFirstUnsolvedCountryId(countries, answered)
    );
  }

  return (
    getNearestCountryId(countries, originCountryId, answered, excludedCountryIds) ??
    getFirstUnsolvedCountryId(countries, answered, [...excludedCountryIds, originCountryId]) ??
    getNearestCountryId(countries, originCountryId, answered) ??
    getFirstUnsolvedCountryId(countries, answered, [originCountryId])
  );
}
