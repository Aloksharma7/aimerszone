import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/student", "/teacher", "/staff", "/accounting", "/admin"];

function createNonce(): string {
  return btoa(crypto.randomUUID()).replace(/=+$/g, "");
}

function configuredApiOrigin(): string | null {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || process.env.NODE_ENV !== "production" ? url.origin : null;
  } catch {
    return null;
  }
}

/*
 * eSewa checkout is a real cross-origin form POST — the gateway does not accept
 * a fetch or a JSON body, and the payer must land on their domain. With
 * `form-action 'self'` the browser blocks the submission silently: form.submit()
 * does not throw, so the button spins forever and nothing is reported.
 *
 * Both the sandbox and production hosts are listed because the environment is
 * an administrator setting, not a build-time constant.
 */
const DEFAULT_PAYMENT_FORM_HOSTS = [
  "https://esewa.com.np",
  "https://epay.esewa.com.np",
  "https://rc-epay.esewa.com.np",
  "https://rc.esewa.com.np",
];

function paymentFormActions(): string[] {
  const configured = process.env.NEXT_PUBLIC_PAYMENT_FORM_ORIGINS;
  if (!configured) return DEFAULT_PAYMENT_FORM_HOSTS;
  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.startsWith("https://"));
}

function buildContentSecurityPolicy(nonce: string, development: boolean): string {
  const apiOrigin = configuredApiOrigin();
  const connectSources = ["'self'", apiOrigin, development ? "ws:" : null, development ? "wss:" : null].filter(Boolean).join(" ");
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Public storage (course thumbnails, payment method QR images, ...) is
    // served straight from Laravel's APP_URL rather than proxied, and a
    // local APP_URL is plain http:. Same dev-only relaxation as connect-src
    // below — production still requires https: strictly.
    `img-src 'self' data: blob: https:${development ? " http:" : ""}`,
    "font-src 'self' data:",
    `connect-src ${connectSources}`,
    `media-src 'self' blob: https:${development ? " http:" : ""}`,
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${paymentFormActions().join(" ")}`.trim(),
    "frame-ancestors 'none'",
    development ? "" : "upgrade-insecure-requests",
  ];
  return directives.filter(Boolean).join("; ");
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  const sessionCookieName = process.env.SESSION_COOKIE_NAME || "lms_session";

  if (isProtected && !mockMode && !request.cookies.has(sessionCookieName)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const nonce = createNonce();
  const development = process.env.NODE_ENV !== "production";
  const csp = buildContentSecurityPolicy(nonce, development);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-lms-path", `${pathname}${request.nextUrl.search}`);
  requestHeaders.set("x-request-id", request.headers.get("x-request-id") || crypto.randomUUID());

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");
  if (isProtected) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  if (!development) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|sanctum|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
