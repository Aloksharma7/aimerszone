import "server-only";

import { cache } from "react";
import type { ApiResponse } from "@/lib/api/contracts";
import { serverApiFetch } from "@/lib/api/server-client";
import { isMockDataEnabled } from "@/lib/data/config";
import { siteConfig } from "@/lib/site";

export type PublicSettings = {
  name: string;
  shortName: string;
  tagline: string;
  logoUrl: string | null;
  address: string;
  mapUrl: string;
  website: string | null;
  phone: string;
  whatsapp: string;
  email: string;
  supportHours: string;
  timezone: string;
  currency: string;
  registrationOpen: boolean;
  maintenanceNotice: string | null;
};

type ApiPublicSettings = {
  institution_name: string;
  short_name: string | null;
  tagline: string | null;
  logo_url: string | null;
  timezone: string;
  currency: string;
  address: string | null;
  map_url: string | null;
  website: string | null;
  support: { whatsapp: string | null; phone: string | null; email: string | null; hours: string | null };
  registration_open: boolean;
  maintenance_notice: string | null;
};

/** The compiled-in values, used as a fallback only. */
const fallback: PublicSettings = {
  name: siteConfig.name,
  shortName: siteConfig.shortName,
  tagline: siteConfig.tagline,
  logoUrl: null,
  address: siteConfig.address,
  mapUrl: siteConfig.mapUrl,
  website: null,
  phone: siteConfig.phone,
  whatsapp: siteConfig.whatsapp,
  email: siteConfig.email,
  supportHours: siteConfig.supportHours,
  timezone: siteConfig.timezone,
  currency: siteConfig.currency,
  registrationOpen: true,
  maintenanceNotice: null,
};

/**
 * Institution identity, owned by the administrator.
 *
 * These values used to come from NEXT_PUBLIC_* variables, which meant changing
 * the institution name needed a rebuild and a redeploy. They now come from
 * /admin/settings through this endpoint.
 *
 * Cached per request via React `cache`, so a page rendering the header, footer
 * and a contact block makes one call, not three.
 *
 * A failure here must never take down the public site: an unreachable API falls
 * back to the compiled-in defaults rather than throwing, because a site that
 * renders with a slightly stale name is better than one that renders a 500.
 */
export const getPublicSettings = cache(async (): Promise<PublicSettings> => {
  if (isMockDataEnabled()) return fallback;

  try {
    const response = await serverApiFetch<ApiResponse<ApiPublicSettings>>("/api/v1/public/settings");
    const data = response.data;

    return {
      name: data.institution_name || fallback.name,
      shortName: data.short_name || fallback.shortName,
      tagline: data.tagline || fallback.tagline,
      logoUrl: data.logo_url,
      address: data.address || fallback.address,
      mapUrl: data.map_url || fallback.mapUrl,
      website: data.website,
      phone: data.support.phone || fallback.phone,
      whatsapp: data.support.whatsapp || fallback.whatsapp,
      email: data.support.email || fallback.email,
      supportHours: data.support.hours || fallback.supportHours,
      timezone: data.timezone || fallback.timezone,
      currency: data.currency || fallback.currency,
      registrationOpen: data.registration_open,
      maintenanceNotice: data.maintenance_notice,
    };
  } catch {
    return fallback;
  }
});
