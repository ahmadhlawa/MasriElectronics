import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderApp, storefrontRoutes, stubApi } from "./utils.jsx";

describe("TFN footer credit", () => {
  it("shows the TFN credit in the storefront footer", async () => {
    stubApi(storefrontRoutes);
    renderApp("/");

    const credit = await screen.findByText("Developed by TFN Technologies Team");
    expect(credit.closest(".vs-footer__credit")).not.toBeNull();
    expect(credit.previousElementSibling).toHaveAttribute("src", "/branding/tfn.png");
    expect(credit.previousElementSibling).toHaveAttribute("alt", "TFN Technologies Team");

  });

  it("does not show the TFN credit in the admin workspace", async () => {
    stubApi(storefrontRoutes);
    renderApp("/admin");
    await waitFor(() => expect(document.querySelector(".vs-public")).toBeNull());
    expect(screen.queryByText("Developed by TFN Technologies Team")).not.toBeInTheDocument();
  });

  it("renders only enabled social links that have URLs", async () => {
    stubApi({
      ...storefrontRoutes,
      "/api/v1/store/settings": {
        ...storefrontRoutes["/api/v1/store/settings"],
        instagram_url: "https://instagram.com/masri",
        instagram_visible: true,
        facebook_url: "https://facebook.com/masri",
        facebook_visible: false,
        tiktok_url: "",
        tiktok_visible: true,
        youtube_url: "https://youtube.com/@masri",
        youtube_visible: true,
      },
    });
    renderApp("/");

    const instagram = await screen.findByRole("link", { name: "إنستغرام" });
    expect(instagram).toHaveAttribute("href", "https://instagram.com/masri");
    expect(instagram).toHaveAttribute("target", "_blank");
    expect(instagram).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("link", { name: "فيسبوك" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "تيك توك" })).not.toBeInTheDocument();
    const youtube = screen.getByRole("link", { name: "يوتيوب" });
    expect(youtube).toHaveAttribute("href", "https://youtube.com/@masri");
    expect(youtube).toHaveAttribute("target", "_blank");
    expect(youtube).toHaveAttribute("rel", "noopener noreferrer");
    const footer = screen.getByRole("contentinfo");
    const contact = within(footer).getByRole("heading", { name: "تواصل معنا" }).closest("div");
    expect(within(contact).getByRole("link", { name: "إنستغرام" })).toBe(instagram);
    expect(within(contact).getByRole("link", { name: "يوتيوب" })).toBe(youtube);
    expect(footer.querySelector(".vs-footer__bottom-row .vs-footer__social-row")).toBeNull();
  });

  it("omits the social row when no visible social URL is configured", async () => {
    stubApi({
      ...storefrontRoutes,
      "/api/v1/store/settings": {
        ...storefrontRoutes["/api/v1/store/settings"],
        instagram_url: "",
        instagram_visible: true,
        facebook_url: "https://facebook.com/masri",
        facebook_visible: false,
      },
    });
    renderApp("/");

    await screen.findByText("Developed by TFN Technologies Team");
    expect(document.querySelector(".vs-footer__social-row")).toBeNull();
  });
});
