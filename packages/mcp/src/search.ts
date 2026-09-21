import type { Doc, Example } from "./content.js";

export type SearchHit = Readonly<{ kind: "doc" | "example"; id: string; title: string; score: number; excerpt: string }>;

const words = (text: string): string[] => text.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) ?? [];

/** Plurals and -ing forms should find each other; nothing cleverer is needed for a corpus this size. */
const stem = (word: string): string => word.replace(/(ing|ed|es|s)$/, "");

/**
 * Splits a doc into its `##` sections, so a hit points at the paragraph that
 * answers the question rather than at a whole page the agent then has to read.
 */
function sections(doc: Doc): readonly Readonly<{ heading: string; text: string }>[] {
  const parts = doc.body.split(/\n(?=##\s)/);
  return parts.map((part) => ({ heading: /^#{1,3}\s+(.+)$/m.exec(part)?.[1] ?? doc.title, text: part }));
}

function score(query: readonly string[], heading: string, text: string, boost: string): number {
  const inHeading = new Set(words(heading).map(stem));
  const inBoost = new Set(words(boost).map(stem));
  const counts = new Map<string, number>();
  for (const word of words(text)) counts.set(stem(word), (counts.get(stem(word)) ?? 0) + 1);
  let total = 0;
  let matched = 0;
  for (const term of query) {
    const found = (counts.get(term) ?? 0) + (inHeading.has(term) ? 6 : 0) + (inBoost.has(term) ? 4 : 0);
    if (found > 0) matched += 1;
    // Diminishing returns: a section that says "canvas" forty times is not forty times as relevant.
    total += Math.log2(1 + found);
  }
  // A section matching every term beats one that matches a single term many times.
  return total * (matched / query.length) ** 2;
}

export function search(query: string, docs: readonly Doc[], examples: readonly Example[], limit = 6): readonly SearchHit[] {
  const terms = [...new Set(words(query).map(stem))].filter((term) => term.length > 1);
  if (terms.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const doc of docs) {
    for (const section of sections(doc)) {
      const value = score(terms, section.heading, section.text, `${doc.title} ${doc.summary}`);
      if (value > 0) hits.push({ kind: "doc", id: doc.topic, title: `${doc.title} › ${section.heading}`, score: value, excerpt: section.text.trim().slice(0, 1_200) });
    }
  }
  for (const example of examples) {
    const value = score(terms, example.title, `${example.summary} ${example.source}`, `${example.techniques.join(" ")} ${example.packages.join(" ")}`);
    if (value > 0) hits.push({ kind: "example", id: example.id, title: example.title, score: value, excerpt: example.summary });
  }
  return hits.sort((left, right) => right.score - left.score).slice(0, limit);
}
