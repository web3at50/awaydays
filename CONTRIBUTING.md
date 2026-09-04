# Contributing

Thanks for taking an interest. A few honest words about what to expect.

## What this project is

Awaydays is a family's real holiday diary that happens to be open source.
It is maintained for that family first, in spare time. Improvements are
synced outward from their private copy periodically. That means:

- **Bug fixes are very welcome.** If something is broken, a pull request
  with a fix and a sentence on how you tested it is the ideal contribution.
- **Feature ideas are genuinely welcome too.** Please open an issue first
  and describe what you would like and why. Some ideas will be taken up,
  some will be a better fit for a fork and some will sit for a while, with no
  promises on timing.
- **Large feature pull requests without a prior issue** may be declined,
  simply because reviewing them properly takes more time than there is.
  That is not a comment on the work.
- **Forking is encouraged.** The MIT licence exists precisely so you can
  take this and make it yours: different stack, different look, whatever
  you need. See `docs/porting.md` for a map of what touches what.

## Before you open a pull request

Run the full check suite from `frontend/` and make sure it is green:

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
```

Then verify the change in a browser, ideally at phone width, because the app is
mobile first and most things that look fine on a desktop break on a phone.

Follow the conventions in `docs/`, especially `docs/ui-and-copy.md` for
anything user-facing: UK English, warm and plain, sentence case.

If you add a pure helper to `src/lib`, add a test beside it (`*.test.mjs`,
Node's built-in runner). Anything with I/O is verified in the browser.

## Database changes

Never edit an existing migration. Add a new timestamped file in
`supabase/migrations/` and describe in the pull request what it does and
whether it needs any manual step on an existing installation.

## Licence

By contributing you agree that your contributions are licensed under the
same MIT licence as the rest of the project.
