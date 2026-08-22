/**
 * Colors are copied 1:1 from nepal-lms-frontend/src/app/globals.css so the
 * mobile app reads as the same product, not a reskin. If the web palette
 * changes, mirror the change here too — there is no shared token package yet
 * (see docs/ARCHITECTURE.md).
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ["./src/app/**/*.{js,jsx,ts,tsx}", "./src/components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e3a8a",
          900: "#172554",
          950: "#0b1739",
        },
        accent: {
          50: "#fffbeb",
          100: "#fef3c7",
          600: "#d97706",
          700: "#b45309",
        },
        canvas: "#f8fafc",
        success: { 100: "#dcfce7", 700: "#15803d" },
        warning: { 100: "#fef9c3", 700: "#a16207" },
        danger: { 100: "#fee2e2", 700: "#b91c1c" },
        info: { 100: "#e0f2fe", 700: "#0369a1" },
      },
    },
  },
  plugins: [],
};
