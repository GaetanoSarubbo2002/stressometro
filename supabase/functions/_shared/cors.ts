function configuredOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function requestOrigin(req: Request): string {
  return (req.headers.get("origin") ?? "").replace(/\/$/, "");
}

export function isAllowedOrigin(req: Request): boolean {
  const origin = requestOrigin(req);
  const allowed = configuredOrigins();
  if (!origin) return false;
  if (allowed.includes("*")) return true;
  if (allowed.includes(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function corsHeaders(req: Request, publicEndpoint = false): HeadersInit {
  const origin = requestOrigin(req);
  const allowed = publicEndpoint || isAllowedOrigin(req);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : "null",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export function json(req: Request, body: unknown, status = 200, publicEndpoint = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req, publicEndpoint),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
