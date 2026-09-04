import Link from "next/link";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="shrink-0 text-xl font-bold tracking-[-0.035em] text-amber-800 hover:text-amber-900"
          >
            Holidays
          </Link>
          <nav
            aria-label="Main navigation"
            className="flex items-center gap-2 sm:gap-4"
          >
            <Link
              href="/adventures/new"
              className="whitespace-nowrap rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800"
            >
              + Trip
            </Link>
            <Link
              href="/plans"
              className="px-1 py-1.5 text-sm text-stone-600 hover:text-stone-900"
            >
              Plans
            </Link>
            <Link
              href="/map"
              className="px-1 py-1.5 text-sm text-stone-600 hover:text-stone-900"
            >
              Map
            </Link>
            <Link
              href="/settings"
              className="px-1 py-1.5 text-sm text-stone-600 hover:text-stone-900"
            >
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex-1 w-full max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}
