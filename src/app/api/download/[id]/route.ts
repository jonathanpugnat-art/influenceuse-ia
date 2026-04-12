import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // TODO: Implémenter le téléchargement ZIP OnlyFans
  return NextResponse.json({ error: "Not implemented", id }, { status: 501 });
}

