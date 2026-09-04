import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createShareLink, revokeShareLink } from "@/lib/share-actions";
import { ShareLinkCreator } from "@/components/ShareLinkCreator";
import { ShareLinkUrl } from "@/components/ShareLinkUrl";

interface ShareLinkRow {
  id: string;
  label: string | null;
  token: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Local JWT verification, matching proxy.ts — pages never call the Auth
  // server. Server actions still use auth.getUser() per mutation.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub ?? null;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("role").eq("id", userId).single()
    : { data: null };

  const { data: adventure } = await supabase
    .from("adventures")
    .select("id, slug, title")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();
  if (!adventure) notFound();

  if (profile?.role !== "admin") {
    return (
      <div className="text-center bg-white rounded-2xl border border-stone-200 p-10">
        <p className="font-medium mb-1">Adults only</p>
        <p className="text-stone-500 text-sm">
          Only adult accounts can create sharing links.
        </p>
      </div>
    );
  }

  const { data: links } = await supabase
    .from("share_links")
    .select(
      "id, label, token, created_at, expires_at, revoked_at, last_viewed_at, view_count",
    )
    .eq("adventure_id", adventure.id)
    .order("created_at", { ascending: false })
    .overrideTypes<ShareLinkRow[]>();

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  const now = new Date();

  return (
    <div className="max-w-xl">
      <Link
        href={`/adventures/${adventure.slug}`}
        className="text-sm text-amber-800 hover:underline"
      >
        ← {adventure.title}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mt-3 mb-2">
        Share this trip
      </h1>
      <p className="text-stone-500 text-sm mb-6">
        Shared pages are read-only, show web-sized photos only, and are hidden
        from search engines. Treat the link like a key: anyone who has it can
        look inside until it expires or you revoke it.
      </p>

      <ShareLinkCreator
        action={createShareLink.bind(null, adventure.id, adventure.slug)}
      />

      {(links?.length ?? 0) > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold text-lg mb-3">Existing links</h2>
          <ul className="space-y-3">
            {links!.map((link) => {
              const expired =
                link.expires_at && new Date(link.expires_at) < now;
              const status = link.revoked_at
                ? "Revoked"
                : expired
                  ? "Expired"
                  : "Active";
              return (
                <li
                  key={link.id}
                  className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {link.label ?? "Unnamed link"}{" "}
                        <span
                          className={
                            status === "Active"
                              ? "text-green-700"
                              : "text-stone-500"
                          }
                        >
                          · {status}
                        </span>
                      </p>
                      <p className="text-xs text-stone-500">
                        Created {format(parseISO(link.created_at), "d MMM yyyy")}
                        {" · "}
                        {link.expires_at
                          ? `expires ${format(parseISO(link.expires_at), "d MMM yyyy")}`
                          : "never expires"}
                        {" · "}
                        {link.view_count === 0
                          ? "not viewed yet"
                          : `viewed ${link.view_count} time${link.view_count === 1 ? "" : "s"}`}
                        {link.last_viewed_at &&
                          `, last on ${format(parseISO(link.last_viewed_at), "d MMM yyyy")}`}
                      </p>
                    </div>
                    {status === "Active" && (
                      <form
                        action={revokeShareLink.bind(
                          null,
                          link.id,
                          adventure.slug,
                        )}
                      >
                        <button
                          type="submit"
                          className="rounded-lg border border-red-200 bg-red-50 text-sm font-medium px-3 py-1.5 text-red-700 hover:bg-red-100"
                        >
                          Revoke
                        </button>
                      </form>
                    )}
                  </div>
                  {status === "Active" &&
                    (link.token ? (
                      <div className="mt-3">
                        <ShareLinkUrl
                          url={`${protocol}://${host}/share/${link.token}`}
                        />
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-stone-500">
                        Made before the app kept link URLs, so this one
                        can&apos;t be shown again.
                      </p>
                    ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
