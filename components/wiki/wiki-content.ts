import type { JSONContent } from "@tiptap/core";

export const WIKI_RICH_PREFIX = "[[coordi-wiki-rich-v1]]";

export function storedWikiDocument(value: string): JSONContent | null {
  if (!value.startsWith(WIKI_RICH_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(WIKI_RICH_PREFIX.length)) as JSONContent;
    return parsed?.type === "doc" ? parsed : null;
  } catch {
    return null;
  }
}

export function wikiEditorDocument(value: string): JSONContent {
  const rich = storedWikiDocument(value);
  if (rich) return rich;
  return {
    type: "doc",
    content: value.split(/\n/).map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

export function serializeWikiDocument(document: JSONContent) {
  return `${WIKI_RICH_PREFIX}${JSON.stringify(document)}`;
}

export function wikiPlainText(value: string): string {
  const document = storedWikiDocument(value);
  if (!document) return value;
  const collect = (node: JSONContent): string => {
    if (typeof node.text === "string") return node.text;
    return (node.content ?? []).map(collect).join(node.type === "tableCell" || node.type === "tableHeader" ? "\t" : " ");
  };
  return collect(document).replace(/[ \t]+/g, " ").trim();
}

export function wikiContentLength(value: string) {
  return wikiPlainText(value).length;
}
