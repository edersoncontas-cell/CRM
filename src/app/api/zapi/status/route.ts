import { NextResponse } from "next/server";
import * as zapi from "@/lib/zapi";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const status = await zapi.statusConexao(await zapi.urlWebhookCrm());
  return NextResponse.json(status);
}
