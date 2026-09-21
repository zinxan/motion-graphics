export const textFontCategoryOrder = ["system", "sans", "serif", "display", "monospace"] as const;
export type TextFontCategory = typeof textFontCategoryOrder[number];
export type TextFontAvailability = "generic" | "common" | "macos";

export type TextFontOption = Readonly<{
  id: string;
  label: string;
  category: TextFontCategory;
  availability: TextFontAvailability;
  fontFamily: string;
}>;

export const textFontCategoryLabels: Readonly<Record<TextFontCategory, string>> = {
  system: "System",
  sans: "Sans serif",
  serif: "Serif",
  display: "Display",
  monospace: "Monospace",
};

const font = (
  id: string,
  label: string,
  category: TextFontCategory,
  availability: TextFontAvailability,
  fontFamily: string,
): TextFontOption => ({ id, label, category, availability, fontFamily });

export const defaultTextFontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const textFontCatalog: readonly TextFontOption[] = [
  font("system-ui", "System UI", "system", "generic", 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'),
  font("system-rounded", "System Rounded", "system", "generic", 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", sans-serif'),
  font("system-serif", "System Serif", "system", "generic", 'ui-serif, "New York", Georgia, serif'),
  font("system-mono", "System Mono", "system", "generic", 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace'),

  font("inter", "Inter / System", "sans", "common", defaultTextFontFamily),
  font("helvetica-neue", "Helvetica Neue", "sans", "macos", '"Helvetica Neue", Helvetica, Arial, sans-serif'),
  font("avenir-next", "Avenir Next", "sans", "macos", '"Avenir Next", Avenir, "Segoe UI", Arial, sans-serif'),
  font("arial", "Arial", "sans", "common", 'Arial, Helvetica, "Liberation Sans", sans-serif'),
  font("verdana", "Verdana", "sans", "common", 'Verdana, Geneva, "DejaVu Sans", sans-serif'),
  font("trebuchet", "Trebuchet", "sans", "common", '"Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", Arial, sans-serif'),
  font("gill-sans", "Gill Sans", "sans", "macos", '"Gill Sans", "Gill Sans MT", Calibri, sans-serif'),
  font("futura", "Futura", "sans", "macos", 'Futura, "Trebuchet MS", Arial, sans-serif'),
  font("optima", "Optima", "sans", "macos", 'Optima, Candara, "Segoe UI", sans-serif'),
  font("century-gothic", "Century Gothic", "sans", "common", '"Century Gothic", AppleGothic, Futura, sans-serif'),
  font("geneva", "Geneva", "sans", "macos", 'Geneva, Tahoma, Verdana, sans-serif'),

  font("georgia", "Georgia", "serif", "common", 'Georgia, "Times New Roman", serif'),
  font("new-york", "New York", "serif", "macos", '"New York", "Iowan Old Style", Georgia, serif'),
  font("charter", "Charter", "serif", "macos", 'Charter, "Bitstream Charter", "Sitka Text", Georgia, serif'),
  font("baskerville", "Baskerville", "serif", "macos", 'Baskerville, "Baskerville Old Face", "Times New Roman", serif'),
  font("didot", "Didot", "serif", "macos", 'Didot, "Bodoni MT", "Times New Roman", serif'),
  font("palatino", "Palatino", "serif", "common", 'Palatino, "Palatino Linotype", "Book Antiqua", serif'),
  font("hoefler", "Hoefler Text", "serif", "macos", '"Hoefler Text", "Baskerville Old Face", Georgia, serif'),
  font("times", "Times New Roman", "serif", "common", '"Times New Roman", Times, "Liberation Serif", serif'),
  font("iowan", "Iowan Old Style", "serif", "macos", '"Iowan Old Style", "Palatino Linotype", Palatino, serif'),

  font("american-typewriter", "American Typewriter", "display", "macos", '"American Typewriter", Rockwell, "Courier New", serif'),
  font("copperplate", "Copperplate", "display", "macos", 'Copperplate, "Copperplate Gothic Light", Georgia, serif'),
  font("rockwell", "Rockwell", "display", "common", 'Rockwell, "Rockwell Nova", "Roboto Slab", serif'),
  font("impact", "Impact", "display", "common", 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif'),
  font("arial-black", "Arial Black", "display", "common", '"Arial Black", "Arial Bold", Gadget, sans-serif'),

  font("sf-mono", "SF Mono", "monospace", "macos", '"SFMono-Regular", "SF Mono", Menlo, monospace'),
  font("menlo", "Menlo", "monospace", "macos", 'Menlo, Monaco, Consolas, "Liberation Mono", monospace'),
  font("monaco", "Monaco", "monospace", "macos", 'Monaco, Menlo, Consolas, monospace'),
  font("consolas", "Consolas", "monospace", "common", 'Consolas, "Liberation Mono", "Courier New", monospace'),
  font("courier-new", "Courier New", "monospace", "common", '"Courier New", Courier, "Liberation Mono", monospace'),
  font("andale-mono", "Andale Mono", "monospace", "common", '"Andale Mono", "Lucida Console", Monaco, monospace'),
];

export const findTextFont = (fontFamily: string): TextFontOption | undefined =>
  textFontCatalog.find((option) => option.fontFamily === fontFamily);

export const textFontsByCategory = (category: TextFontCategory): readonly TextFontOption[] =>
  textFontCatalog.filter((option) => option.category === category);
