import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IntroGate } from "./IntroGate";

describe("IntroGate", () => {
  it("skips the animation when reduced motion is requested", () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    sessionStorage.clear();
    render(<IntroGate><p>Landing copy</p></IntroGate>);
    expect(screen.getByText("Landing copy")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
  });

  it("shows a skip control on a fresh session", () => {
    window.matchMedia = (() => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    sessionStorage.clear();
    render(<IntroGate><p>Landing copy</p></IntroGate>);
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    expect(screen.queryByText("Landing copy")).not.toBeInTheDocument();
  });
});
