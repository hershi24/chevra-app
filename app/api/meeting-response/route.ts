import { handleMeetingResponse, paramsFromYemot } from "@/lib/yemot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleMeetingResponse(await paramsFromYemot(request));
}

export async function POST(request: Request) {
  return handleMeetingResponse(await paramsFromYemot(request));
}
