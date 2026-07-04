import { NextResponse } from "next/server";
import * as zapi from "@/lib/zapi";

export const dynamic = "force-dynamic";

export async function GET() {
  const qr = await zapi.obterQrCode();
  return NextResponse.json(qr);
}
