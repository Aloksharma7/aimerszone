import type { MetadataRoute } from "next";
import { getPublicSettings } from "@/lib/data/settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getPublicSettings();
  return {
    name: settings.name,
    short_name: settings.shortName,
    description: settings.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#172554",
  };
}
