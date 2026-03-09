import type { CountryRecord } from "../game/gameTypes";

export function getFilteredCountries(countries: CountryRecord[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return countries;
  }

  return countries.filter((country) =>
    country.displayName.toLowerCase().includes(normalizedQuery)
  );
}

export function getSuggestedCountry(countries: CountryRecord[], query: string) {
  const normalizedQuery = query.toLowerCase();
  const normalizedTrimmedQuery = query.trimEnd().toLowerCase();

  if (!normalizedTrimmedQuery.trim()) {
    return null;
  }

  return (
    countries.find((country) => {
      const normalizedDisplayName = country.displayName.toLowerCase();

      return (
        normalizedDisplayName.startsWith(normalizedQuery) ||
        normalizedDisplayName === normalizedTrimmedQuery
      );
    }) ?? null
  );
}

export function getSuggestedSuffix(
  query: string,
  suggestedCountry: CountryRecord | null
) {
  if (!suggestedCountry || !query) {
    return null;
  }

  return suggestedCountry.displayName.slice(query.length);
}
