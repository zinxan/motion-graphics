import { describe, expect, it } from "vitest";
import {
  defaultTextFontFamily,
  findTextFont,
  textFontCatalog,
  textFontCategoryOrder,
  textFontsByCategory,
} from "./font-catalog";

describe("2D text font catalog", () => {
  it("provides a substantial, unique selection in every category", () => {
    expect(textFontCatalog.length).toBeGreaterThanOrEqual(30);
    expect(new Set(textFontCatalog.map(({ id }) => id)).size).toBe(textFontCatalog.length);
    expect(new Set(textFontCatalog.map(({ fontFamily }) => fontFamily)).size).toBe(textFontCatalog.length);
    for (const category of textFontCategoryOrder) {
      expect(textFontsByCategory(category).length).toBeGreaterThan(0);
    }
  });

  it("serializes ordered stacks ending in a standards-defined generic fallback", () => {
    for (const option of textFontCatalog) {
      expect(option.fontFamily).toMatch(/(?:sans-serif|serif|monospace)$/);
      expect(option.fontFamily).not.toMatch(/(?:url\(|@font-face|local\()/i);
      expect(JSON.parse(JSON.stringify(option))).toEqual(option);
    }
  });

  it("keeps the default stack discoverable and preserves exact family lookup", () => {
    expect(findTextFont(defaultTextFontFamily)).toMatchObject({ id: "inter" });
    expect(findTextFont('"Unregistered Font", sans-serif')).toBeUndefined();
  });
});
