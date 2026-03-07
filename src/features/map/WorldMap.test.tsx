import { fireEvent, render, screen } from "@testing-library/react";
import { WorldMap } from "./WorldMap";

const countries = [
  {
    id: "ar",
    displayName: "Argentina",
    svgPath: "M 0 0 L 20 0 L 20 20 L 0 20 Z",
    centroid: [10, 10] as [number, number],
    bbox: [0, 0, 20, 20] as [number, number, number, number]
  },
  {
    id: "br",
    displayName: "Brazil",
    svgPath: "M 40 0 L 60 0 L 60 20 L 40 20 Z",
    centroid: [50, 10] as [number, number],
    bbox: [40, 0, 60, 20] as [number, number, number, number]
  }
];

describe("WorldMap", () => {
  it("dispatches the clicked country id", () => {
    const onCountrySelect = vi.fn();

    render(
      <WorldMap
        countries={countries}
        flashEvent={null}
        onCountrySelect={onCountrySelect}
        selectedCountryId={null}
        solvedCountryIds={[]}
        viewBox="0 0 100 50"
      />
    );

    const brazilPath = screen.getByLabelText("Brazil");

    fireEvent.pointerDown(brazilPath, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1
    });
    fireEvent.pointerUp(brazilPath, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1
    });

    expect(onCountrySelect).toHaveBeenCalledWith("br");
  });

  it("does not dispatch for solved countries", () => {
    const onCountrySelect = vi.fn();

    render(
      <WorldMap
        countries={countries}
        flashEvent={null}
        onCountrySelect={onCountrySelect}
        selectedCountryId={null}
        solvedCountryIds={["br"]}
        viewBox="0 0 100 50"
      />
    );

    const brazilPath = screen.getByLabelText("Brazil");

    fireEvent.pointerDown(brazilPath, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1
    });
    fireEvent.pointerUp(brazilPath, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1
    });

    expect(onCountrySelect).not.toHaveBeenCalled();
  });

  it("clears hover when the pointer moves from a country to the ocean", () => {
    const onCountrySelect = vi.fn();

    render(
      <WorldMap
        countries={countries}
        flashEvent={null}
        onCountrySelect={onCountrySelect}
        selectedCountryId={null}
        solvedCountryIds={[]}
        viewBox="0 0 100 50"
      />
    );

    const worldMap = screen.getByLabelText("World map");
    const argentinaPath = screen.getByLabelText("Argentina");

    fireEvent.pointerEnter(argentinaPath);
    expect(argentinaPath).toHaveClass("world-map__country--hovered");

    fireEvent.pointerMove(worldMap, {
      target: worldMap
    });

    expect(argentinaPath).not.toHaveClass("world-map__country--hovered");
  });
});
