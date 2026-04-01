import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session-service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const removed = await deleteSession(id);

    if (!removed) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session deletion failed", error);
    return NextResponse.json({ error: "Unable to delete the session." }, { status: 500 });
  }
}
