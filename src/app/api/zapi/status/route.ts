import { NextResponse } from "next/server";
import * as zapi from "@/lib/zapi";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await zapi.statusConexao();
  return NextResponse.json(status);
}
