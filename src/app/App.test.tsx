import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";
import { STORAGE_KEY } from "../lib/storage";

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("offers resume when an in-progress session exists", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 4,
        bestRun: null,
        inProgressSession: {
          selectedMapCountryId: "us",
          answered: {},
          stats: {
            startedAt: Date.now(),
            elapsedMs: 90_000,
            wrongClicks: 0,
            skipsUsed: 0,
            revisitedCountries: 0,
            firstTryCorrect: 0,
            completedCountries: 0,
            totalCountries: 1
          }
        }
      })
    );

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /resume run/i }));

    expect(
      await screen.findByPlaceholderText(/type to search unsolved countries/i)
    ).toBeInTheDocument();
  });

  it("selects a country when right arrow is pressed", async () => {
    window.localStorage.clear();

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /new game/i }));
    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(
      await screen.findByPlaceholderText(/type to search unsolved countries/i)
    ).not.toBeDisabled();
  });

  it("supports map click and autocomplete list", async () => {
    window.localStorage.clear();

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /new game/i }));

    fireEvent.pointerDown(screen.getByLabelText("Canada"), {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1
    });
    fireEvent.pointerUp(screen.getByLabelText("Canada"), {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1
    });

    const input = screen.getByPlaceholderText(/type to search unsolved countries/i);
    fireEvent.change(input, { target: { value: "can" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("1/197")).toBeInTheDocument();
  });

  it("shows previous, next, and done controls during play", async () => {
    window.localStorage.clear();

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /new game/i }));
    fireEvent.pointerDown(screen.getByLabelText("Canada"), {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1
    });
    fireEvent.pointerUp(screen.getByLabelText("Canada"), {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1
    });

    expect(screen.getByRole("button", { name: /previous country/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next country/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^done$/i })).toBeInTheDocument();
  });

  it("opens the completion modal when done is pressed", async () => {
    window.localStorage.clear();

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /new game/i }));
    fireEvent.click(screen.getByRole("button", { name: /^done$/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/run complete/i)).toBeInTheDocument();
  });
});
