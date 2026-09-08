export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Aimers Zone",
  shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME || "Aimers Zone",
  tagline:
    process.env.NEXT_PUBLIC_APP_TAGLINE ||
    "Start with an Aim, Finish with Success.",
  phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+977 984-4445200",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "9779844445200",
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "info.aimerszone@gmail.com",
  address: process.env.NEXT_PUBLIC_ADDRESS || "Birgunj, Nepal",
  mapUrl: process.env.NEXT_PUBLIC_MAP_URL || "https://www.google.com/maps/search/?api=1&query=Birgunj%2C%20Nepal",
  supportHours: process.env.NEXT_PUBLIC_SUPPORT_HOURS || "Sunday to Friday, 9:00 AM–6:00 PM (Nepal time). Messages outside these hours remain queued.",
  timezone: "Asia/Kathmandu",
  currency: "NPR",
  facebookUrl: process.env.NEXT_PUBLIC_FACEBOOK_URL || "https://www.facebook.com/aimerszoneclasses",
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/aimers.zone",
  youtubeUrl: process.env.NEXT_PUBLIC_YOUTUBE_URL || "https://www.youtube.com/@aimerszoneclasses",
};
