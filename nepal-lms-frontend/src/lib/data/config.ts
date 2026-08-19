export function isMockDataEnabled(): boolean {
  const enabled = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  const productionAllowed = process.env.ALLOW_MOCK_DATA_IN_PRODUCTION === "true";

  if (enabled && process.env.NODE_ENV === "production" && !productionAllowed) {
    throw new Error(
      "Mock data is enabled in production. Set NEXT_PUBLIC_USE_MOCK_DATA=false or explicitly set ALLOW_MOCK_DATA_IN_PRODUCTION=true for a controlled demo deployment.",
    );
  }

  return enabled;
}

export function apiPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}
