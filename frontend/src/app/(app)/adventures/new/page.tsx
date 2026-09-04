import { createAdventure } from "@/lib/actions";
import { AdventureForm } from "@/components/AdventureForm";

export default function NewAdventurePage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">
        New trip
      </h1>
      <AdventureForm action={createAdventure} submitLabel="Create trip" />
    </div>
  );
}
