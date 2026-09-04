import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Serves a booking document (PDF) to a signed-in family member: a 307
// redirect to a signed storage URL, mirroring /api/media. Documents are
// planning data, so nothing here is ever reachable from a share page.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  // Local JWT verification, matching proxy.ts and /api/media
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) return new NextResponse("Unauthorized", { status: 401 });

  const { data: doc } = await supabase
    .from("itinerary_documents")
    .select("original_path")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const { data } = await supabase.storage
    .from("family-originals")
    .createSignedUrl(doc.original_path, 60 * 60 * 24);
  if (!data) return new NextResponse("Document unavailable", { status: 502 });

  return NextResponse.redirect(data.signedUrl, {
    status: 307,
    headers: { "Cache-Control": "private, max-age=43200" },
  });
}
