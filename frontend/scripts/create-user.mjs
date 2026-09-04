// Create a family member: the auth user plus the matching profile row.
//
// There is deliberately no public sign-up, and profiles can only be inserted
// with the service role, so this is how accounts are made — the first
// admin during setup, and everyone after that.
//
// Usage (from frontend/, with .env.local pointing at the target project):
//   node scripts/create-user.mjs --email you@example.com --name "Your name" --role admin
//   node scripts/create-user.mjs --email kid@example.com --name "Sam"          # role defaults to editor
//
// Add --password to choose the password; otherwise a random one is
// generated and printed once. Either way, change it in Settings after the
// first sign-in. The user is created already confirmed — no email is sent.
//
// Lost the password? --reset-password sets a new one for an existing account:
//   node scripts/create-user.mjs --email you@example.com --reset-password
import crypto from "node:crypto";
import { adminClient, loadEnv } from "./lib.mjs";

loadEnv();
const supabase = adminClient();

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const email = arg("email")?.trim().toLowerCase();
const displayName = arg("name")?.trim();
const role = arg("role", "editor");
const reset = process.argv.includes("--reset-password");
const password = arg("password") ?? crypto.randomBytes(15).toString("base64url");

if (!email || (!reset && (!displayName || !["admin", "editor"].includes(role)))) {
  console.log(
    'Usage: node scripts/create-user.mjs --email <email> --name "<display name>" [--role admin|editor] [--password <password>]\n' +
      "       node scripts/create-user.mjs --email <email> --reset-password [--password <password>]",
  );
  process.exit(1);
}

const { data: existing } = await supabase
  .from("profiles")
  .select("id, display_name")
  .eq("email", email)
  .maybeSingle();

if (reset) {
  if (!existing) {
    console.error(`No account for ${email} — create it first (drop --reset-password).`);
    process.exit(1);
  }
  const { error } = await supabase.auth.admin.updateUserById(existing.id, { password });
  if (error) {
    console.error(`Could not reset the password: ${error.message}`);
    process.exit(1);
  }
  console.log(`Password reset for ${existing.display_name} <${email}>.`);
  if (!arg("password")) console.log(`New password (shown once): ${password}`);
  process.exit(0);
}

if (existing) {
  console.error(
    `A profile for ${email} already exists — nothing to do. (Lost the password? add --reset-password.)`,
  );
  process.exit(1);
}

const { data: created, error: authError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (authError || !created?.user) {
  console.error(`Could not create the auth user: ${authError?.message ?? "unknown error"}`);
  process.exit(1);
}

const { error: profileError } = await supabase.from("profiles").insert({
  id: created.user.id,
  email,
  display_name: displayName,
  role,
});
if (profileError) {
  // Don't leave an auth user without a profile — it could sign in but see nothing
  await supabase.auth.admin.deleteUser(created.user.id);
  console.error(`Could not create the profile: ${profileError.message}`);
  process.exit(1);
}

console.log(`Created ${role} ${displayName} <${email}>.`);
if (!arg("password")) {
  console.log(`Password (shown once, change it in Settings): ${password}`);
}
