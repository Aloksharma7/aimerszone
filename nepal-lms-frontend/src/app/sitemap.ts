import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const paths = ["", "/courses", "/teachers", "/about", "/services", "/faq", "/contact", "/free-learning", "/payment-instructions", "/privacy", "/terms", "/refund-policy", "/recording-policy"];
  return paths.map((path) => ({ url: `${base}${path}`, changeFrequency: path === "" || path === "/courses" ? "weekly" : "monthly", priority: path === "" ? 1 : path === "/courses" ? 0.9 : 0.6 }));
}
