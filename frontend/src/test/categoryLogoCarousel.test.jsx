import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CategoryLogoCarousel from "../components/public/home/CategoryLogoCarousel.jsx";

const categories = [
  { slug: "fridges", name: "ثلاجات", href: "/category/fridges", imageUrl: "/media/fridges.png" },
  { slug: "washers", name: "غسالات", href: "/category/washers", imageUrl: null },
];
let frames, resize, width, groupWidth;
afterEach(() => vi.unstubAllGlobals());
const mount = () => render(<MemoryRouter><CategoryLogoCarousel categories={categories} /></MemoryRouter>);
const viewport = () => screen.getByRole("region", { name: "تسوّق حسب التصنيف" });
const step = (time) => act(() => {
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((callback) => callback(time));
});

beforeEach(() => {
  frames = new Map();
  width = 300;
  groupWidth = 500;
  let id = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((key) => frames.delete(key));
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function () {
    return this.classList.contains("vs-category-logos__viewport") ? width : Math.round(groupWidth);
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ width: groupWidth }));
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(() => groupWidth);
  const computedStyle = window.getComputedStyle;
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = computedStyle(element);
    if (element.classList.contains("vs-category-logos__viewport")) style.direction = "rtl";
    if (element.classList.contains("vs-category-logos__group")) style.paddingInlineEnd = "24px";
    return style;
  });
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() {}
  });
});

describe("category logo carousel", () => {
  it("uses managed images and named category links with a text fallback", () => {
    mount();
    const links = within(viewport()).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/category/fridges");
    expect(links[0].querySelector("img")).toHaveAttribute("src", "/media/fridges.png");
    expect(links[1]).toHaveTextContent("غسالات");
    fireEvent.error(links[0].querySelector("img"));
    expect(links[0].querySelector("img")).toBeNull();
    expect(links[0]).toHaveTextContent("ثلاجات");
    const copy = viewport().querySelector('.vs-category-logos__group[aria-hidden="true"]');
    expect(copy).not.toBeNull();
    expect([...copy.querySelectorAll("a")].every((link) => link.tabIndex === -1)).toBe(true);
  });

  it("moves gently in RTL and wraps by one identical group without a gap", () => {
    mount();
    step(0);
    step(50);
    expect(viewport().scrollLeft).toBeCloseTo(-1);
    // Restart at the boundary to verify the next frame retains the remainder.
    fireEvent.mouseEnter(viewport());
    viewport().scrollLeft = -499.5;
    fireEvent.mouseLeave(viewport());
    step(100);
    step(150);
    expect(viewport().scrollLeft).toBeCloseTo(-0.5);
  });

  it("pauses on hover and focus, then resumes without a time jump", () => {
    mount();
    step(0); step(50);
    fireEvent.mouseEnter(viewport());
    step(1000);
    expect(viewport().scrollLeft).toBeCloseTo(-1);
    fireEvent.mouseLeave(viewport());
    step(1050); step(1100);
    expect(viewport().scrollLeft).toBeCloseTo(-2);
    const link = within(viewport()).getAllByRole("link")[0];
    fireEvent.focus(link);
    step(1200);
    expect(viewport().scrollLeft).toBeCloseTo(-2);
    fireEvent.blur(link, { relatedTarget: document.body });
    step(1250); step(1300);
    expect(viewport().scrollLeft).toBeCloseTo(-3);
  });

  it("preserves fractional group spacing at the loop boundary", () => {
    groupWidth = 500.375;
    mount();
    fireEvent.mouseEnter(viewport());
    viewport().scrollLeft = -499.875;
    fireEvent.mouseLeave(viewport());
    step(0); step(50);
    expect(viewport().scrollLeft).toBeCloseTo(-0.5);
  });

  it.each(["pointerDown", "touchStart", "wheel", "keyDown"])("stops autoplay after %s until explicitly resumed", (event) => {
    mount();
    step(0); step(50);
    fireEvent[event](viewport(), { key: "ArrowLeft" });
    step(100);
    expect(viewport().scrollLeft).toBeCloseTo(-1);
    fireEvent.click(screen.getByRole("button", { name: "تشغيل حركة الأقسام" }));
    step(150); step(200);
    expect(viewport().scrollLeft).toBeCloseTo(-2);
  });

  it("keeps a fitting row still and remeasures when its viewport changes", () => {
    width = 600;
    mount();
    expect(frames.size).toBe(0);
    expect(screen.queryByRole("button")).toBeNull();
    expect(viewport().querySelector('.vs-category-logos__group[aria-hidden="true"]')).toBeNull();
    width = 300;
    act(() => resize());
    step(0); step(50);
    expect(viewport().scrollLeft).toBeCloseTo(-1);
  });

  it("respects reduced motion while retaining native manual scrolling", () => {
    window.__mediaMatches = (query) => query.includes("prefers-reduced-motion");
    mount();
    expect(frames.size).toBe(0);
    expect(screen.queryByRole("button")).toBeNull();
    expect(viewport().querySelector('.vs-category-logos__group[aria-hidden="true"]')).toBeNull();
    viewport().scrollLeft = -100;
    fireEvent.scroll(viewport());
    step(50);
    expect(viewport().scrollLeft).toBe(-100);
  });

  it("cancels pending frames on unmount", () => {
    const { unmount } = mount();
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
  });
});
