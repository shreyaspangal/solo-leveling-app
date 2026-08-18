import { headers } from "next/headers";

// x-forwarded-for is spoofable in general, but Vercel (this app's deploy
// target) sets it itself at the edge before the request reaches app code, so
// it's trustworthy here specifically -- see the api-rate-limiting skill's
// "only trust behind a known proxy" guidance.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return "unknown";
}
