// Trip cards and entry cards show a clamped teaser of the text as flat
// prose, deliberately — see docs/ui-and-copy.md. Markdown syntax that would
// otherwise show through the clamp is reduced to the words a reader actually
// wants: link and image syntax to their text, heading markers dropped, and
// emphasis markers removed. Anything else is left alone, because family
// writing is mostly plain prose and stripping more would risk mangling
// ordinary punctuation.
export function teaserText(summary: string): string {
  return summary
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(?<![\w*])(\*|_)([^*_\n]+?)\1(?![\w*])/g, "$2");
}
