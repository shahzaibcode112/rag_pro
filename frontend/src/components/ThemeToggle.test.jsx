import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ThemeToggle from "./ThemeToggle.jsx";

const root = document.documentElement;

beforeEach(() => {
  localStorage.clear();
  root.removeAttribute("data-theme");
});
afterEach(cleanup);

describe("ThemeToggle", () => {
  it("starts on System (no override) and cycles Light, Dark, System", () => {
    render(<ThemeToggle />);
    const button = () => screen.getByRole("button");

    expect(button().getAttribute("aria-label")).toContain("Theme: System");
    expect(root.hasAttribute("data-theme")).toBe(false);

    fireEvent.click(button());
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("docchat-theme")).toBe("light");

    fireEvent.click(button());
    expect(root.getAttribute("data-theme")).toBe("dark");

    fireEvent.click(button());
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("docchat-theme")).toBe("system");
  });

  it("restores the saved choice", () => {
    localStorage.setItem("docchat-theme", "dark");
    render(<ThemeToggle />);
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByRole("button").getAttribute("aria-label")).toContain("Theme: Dark");
  });

  it("ignores a bad saved value", () => {
    localStorage.setItem("docchat-theme", "banana");
    render(<ThemeToggle />);
    expect(root.hasAttribute("data-theme")).toBe(false);
  });
});
