# Security

Awaydays holds a family's private photos and diary, so security problems
matter more here than in most hobby projects. Thank you for looking.

## Reporting a vulnerability

Please **do not open a public issue** for anything security-related.

Use GitHub's private vulnerability reporting instead: on the repository
page, open the **Security** tab and choose **Report a vulnerability**. That
goes only to the maintainer.

Include what you found, how to reproduce it and what you think the impact
is. A proof-of-concept against your *own* installation is welcome; please
never test against somebody else's.

## What to expect

This is a family project maintained in spare time, not a company with a
security team. Reports are read and taken seriously, but there is no
guaranteed response time. Genuine issues (especially anything that could
expose a family's photos or diary to someone without a valid share link)
will be fixed as a priority and credited in the release notes if you would
like that.

## Scope notes

- Share links are unguessable tokens and shared pages are rendered through
  the service-role client with explicit filtering. The rules in
  `docs/sharing.md` are load-bearing; a bypass of any of them is a
  vulnerability.
- Row-level security in Supabase is the last line of defence for
  signed-in users. A policy gap is a vulnerability even if the UI hides it.
- The Google Maps and ArcGIS keys are public by design and are protected by
  referrer restrictions and quota caps that each installer sets in their own
  console. Their presence in the client bundle is not a vulnerability.
