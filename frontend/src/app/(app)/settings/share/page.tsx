import Link from "next/link";
import { headers } from "next/headers";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import {
  createAllTripsShareLink,
  revokeAllTripsShareLink,
} from "@/lib/share-actions";
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

export default async function AllTripsSharePage() {
  const supabase = await createClient();
  // Local JWT verification, matching proxy.ts — pages never call the Auth
  // server. Server actions still use auth.getUser() per mutation.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub ?? null;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("role").eq("id", userId).single()
    : { data: null };

  if (profile?.role !== "admin") {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
        <p className="mb-1 font-medium">Adults only</p>
        <p className="text-sm text-stone-500">
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
    .eq("scope", "all")
    .is("adventure_id", null)
    .order("created_at", { ascending: false })
    .overrideTypes<ShareLinkRow[]>();

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  const now = new Date();

  return (
    <div className="max-w-xl">
      <Link href="/settings" className="text-sm text-amber-800 hover:underline">
        ← Settings
      </Link>
      <h1 className="mt-3 mb-2 text-2xl font-semibold tracking-tight">
        Share all trips
      </h1>
      <p className="mb-6 text-sm text-stone-500">
        This creates one read-only link to every current and future trip. Photos
        are web-sized and shared pages are hidden from search engines. Anyone
        with the link can look inside until it expires or you revoke it.
      </p>

      <ShareLinkCreator action={createAllTripsShareLink} subject="all our trips" />

      {(links?.length ?? 0) > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Existing links</h2>
          <ul className="space-y-3">
            {links!.map((link) => {
              const expired = link.expires_at && new Date(link.expires_at) < now;
              const status = link.revoked_at
                ? "Revoked"
                : expired
                  ? "Expired"
                  : "Active";
              return (
                <li
                  key={link.id}
                  className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
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
                      <form action={revokeAllTripsShareLink.bind(null, link.id)}>
                        <button
                          type="submit"
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
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
