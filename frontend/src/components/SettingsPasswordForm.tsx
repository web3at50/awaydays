"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";

export function SettingsPasswordForm() {
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    if (password.length < 8) {
      setMessage({ kind: "error", text: "Please choose at least 8 characters." });
      return;
    }
    if (password !== confirm) {
      setMessage({ kind: "error", text: "Those passwords don't match." });
      return;
    }

    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setMessage({
        kind: "error",
        text:
          error.message === "New password should be different from the old password."
            ? "That's already your password. Choose a new one."
            : "Couldn't change the password. Please try again.",
      });
      return;
    }

    form.reset();
    setMessage({ kind: "ok", text: "Password changed. Use it next time you sign in." });
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold mb-1">Change password</h2>
      <p className="text-sm text-stone-500 mb-4">
        Changes the password for the account you&apos;re signed in with.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            New password
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
          />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium mb-1">
            Repeat new password
          </label>
          <PasswordInput
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            minLength={8}
          />
        </div>

        {message && (
          <p
            role="alert"
            className={
              message.kind === "ok"
                ? "text-sm text-green-800 bg-green-50 rounded-lg p-3"
                : "text-sm text-red-700 bg-red-50 rounded-lg p-3"
            }
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-amber-700 text-white font-medium py-3 hover:bg-amber-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </section>
  );
}
