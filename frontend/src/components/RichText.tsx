import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { sharedTripHref } from "@/lib/shared-links";

// Share visitors browse everything under a /share/<token> prefix, so a link
// the family wrote as /adventures/<slug> has to be rewritten to stay inside
// that token — or dropped to plain text when the share cannot reach the
// other trip at all. See sharedTripHref.
export interface ShareLinkContext {
  token: string;
  wholeApp: boolean;
}

// Renders family-written text as Markdown. react-markdown builds React
// elements directly and ignores raw HTML by default, so no sanitiser is
// needed.
//
// remark-breaks turns a single newline into a line break. Without it, plain
// Markdown joins consecutive lines into one paragraph, so text typed in the
// textarea with one Enter between thoughts came out as an unbroken wall of
// text. Nobody writing a holiday diary expects to have to press Enter twice
// — see docs/ui-and-copy.md.
export function RichText({
  text,
  className,
  share,
}: {
  text: string;
  className?: string;
  share?: ShareLinkContext;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={
          share
            ? {
                a({ href, children }) {
                  const shared = href
                    ? sharedTripHref(share.token, href, share.wholeApp)
                    : null;
                  return shared ? <a href={shared}>{children}</a> : <>{children}</>;
                },
              }
            : undefined
        }
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
