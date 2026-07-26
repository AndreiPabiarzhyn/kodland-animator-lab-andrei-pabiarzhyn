import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/i18n";
import { ToolPalette } from "@/components/editor/ToolPalette";

describe("localized editor controls", () => {
  it("renders the tool palette without shadowing the translation function", () => {
    render(
      <LanguageProvider>
        <ToolPalette />
      </LanguageProvider>,
    );

    expect(screen.getByRole("button", { name: "Pencil" })).toBeInTheDocument();
  });
});
