
# Next.js Frontend Context

@../docs/05_SCREEN_SPECIFICATIONS.md
@../docs/09_SYSTEM_ARCHITECTURE.md
@../docs/11_FRONTEND_STANDARDS.md
@../docs/12_UI_DESIGN_SYSTEM.md
@../docs/13_SECURITY_PRIVACY.md
@../docs/26_ROUTE_MAP.md
@../docs/32_API_INTEGRATION_CONTRACTS.md

## Local frontend rules

- Use Next.js 16 App Router, React 19, strict TypeScript, Tailwind 4, and approved shadcn/ui primitives.
- Use Server Components for public/initial reads when suitable and Client Components only for interaction.
- Use the documented server API client for SSR and browser API client for client mutations.
- Use Sanctum cookies and CSRF with Axios credentials/XSRF enabled; never store bearer tokens in browser storage.
- Do not access the database, create a business backend, or implement authoritative mutations in route handlers or Server Actions.
- Do not calculate authoritative price, approval, access, attendance, score, or expiry in the browser.
- Never include Zoom start URLs, payment-proof paths, or correct answers in public/unauthorized output.
- Protected layouts must verify the session through Laravel; middleware is only a navigation optimization.
- Build every role interface in the same design system: public, student, teacher, Enrollment Officer, accountant, and admin.
- Implement 360 px mobile first with accessible keyboard/focus/error behavior.
- Include loading, empty, validation, unauthorized, expired-session, integration-failure, and success states.
- Use OpenAPI-derived types; do not hand-invent incompatible response shapes.
- Do not copy competitor text, assets, layouts, or branding.
- Run lint, typecheck, frontend tests, production build, and relevant Playwright flows.
