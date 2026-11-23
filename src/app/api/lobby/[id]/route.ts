import { currentUserId } from "@/auth";
import { loadLobbySnapshot } from "@/lib/db/queries";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

/**
 * The live state of one lobby — what the phone feed and the TV both poll.
 *
 * Members only: 403 for anyone else, which is also how a removed player's screen
 * learns it has been removed. 503 means "try again", not "you are out", so a
 * database blip never kicks anybody off the page.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ snapshot: null }, { status: 404, headers: noStore });

  const userId = await currentUserId();
  if (!userId) return Response.json({ snapshot: null }, { status: 401, headers: noStore });

  try {
    const snapshot = await loadLobbySnapshot(id, userId);
    if (!snapshot) return Response.json({ snapshot: null }, { status: 403, headers: noStore });
    return Response.json({ snapshot }, { headers: noStore });
  } catch {
    return Response.json({ snapshot: null }, { status: 503, headers: noStore });
  }
}
