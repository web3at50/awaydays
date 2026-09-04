import { RichText, type ShareLinkContext } from "@/components/RichText";

// Diary text, in the typography the entry pages use. The Markdown rules and
// the share-link handling live in RichText, which trip summaries share.
export function EntryBody({
  body,
  share,
}: {
  body: string;
  share?: ShareLinkContext;
}) {
  return (
    <RichText
      text={body}
      share={share}
      className="prose prose-stone max-w-none mt-4 prose-headings:font-semibold prose-a:text-amber-800"
    />
  );
}
