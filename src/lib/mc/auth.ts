import type { NextRequest } from "next/server";
import { timingSafeEqualStr } from "@/lib/crypto";

// Shared token used by the in-game bridge plugin for every server→site call
// (status push, command poll/ack, account-link confirm). MC_INGEST_TOKEN is the
// canonical name; BRIDGE_TOKEN is accepted for backwards compatibility.
export function mcTokenAuthorized(req: NextRequest): boolean {
  const expected = process.env.MC_INGEST_TOKEN || process.env.BRIDGE_TOKEN || "";
  if (!expected) return false;
  const got = req.headers.get("x-tcc-token") ?? "";
  return got.length > 0 && timingSafeEqualStr(got, expected);
}
