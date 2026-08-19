export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Institution LMS",
  shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME || "IL",
  tagline:
    process.env.NEXT_PUBLIC_APP_TAGLINE ||
    "Live classes, recordings, tests and support in one clear place.",
  phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+977 9800000000",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "9779800000000",
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.test",
  address: process.env.NEXT_PUBLIC_ADDRESS || "Kathmandu, Nepal",
  mapUrl: process.env.NEXT_PUBLIC_MAP_URL || "https://www.google.com/maps/search/?api=1&query=Kathmandu%2C%20Nepal",
  supportHours: process.env.NEXT_PUBLIC_SUPPORT_HOURS || "Sunday to Friday, 9:00 AM–6:00 PM (Nepal time). Messages outside these hours remain queued.",
  timezone: "Asia/Kathmandu",
  currency: "NPR",
};
