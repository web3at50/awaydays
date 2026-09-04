import Link from "next/link";
import { signOut } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { getFamilySettings } from "@/lib/settings";
import { HomeLocationForm } from "@/components/HomeLocationForm";
import { SettingsPasswordForm } from "@/components/SettingsPasswordForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  // Local JWT verification, matching proxy.ts — pages never call the Auth
  // server. Server actions still use auth.getUser() per mutation.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub ?? null;

  const { data: profile } = userId
    ? await supabase.from("profiles").select("role").eq("id", userId).single()
    : { data: null };
  const isAdmin = profile?.role === "admin";
  const familySettings = isAdmin ? await getFamilySettings(supabase) : null;

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-stone-500">
          Manage your account and app options.
        </p>
      </div>

      <div className="space-y-5">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold mb-1">Account</h2>
          <p className="text-sm text-stone-500 mb-4">
            Account actions and deleted items.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {isAdmin && (
              <Link
                href="/bin"
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 hover:border-amber-600 hover:text-amber-800"
              >
                <span aria-hidden>🗑️</span>
                Recycle bin
              </Link>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              >
                <span aria-hidden>↪</span>
                Sign out
              </button>
            </form>
          </div>
        </section>

        {isAdmin && (
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold">Home</h2>
            <p className="mb-4 text-sm text-stone-500">
              Where every journey sets off from and returns to.
            </p>
            <HomeLocationForm current={familySettings?.home_location ?? null} />
          </section>
        )}

        {isAdmin && (
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold">Sharing</h2>
            <p className="mb-4 text-sm text-stone-500">
              Create a read-only link that lets someone browse all our trips.
            </p>
            <Link
              href="/settings/share"
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 py-3 text-sm font-medium text-white hover:bg-amber-800"
            >
              <span aria-hidden>🔗</span>
              Share all trips
            </Link>
          </section>
        )}

        <SettingsPasswordForm />
      </div>
    </div>
  );
}
