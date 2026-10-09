# Ive POS public website — research and design decisions

Research date: 6 October 2026. Skills used: `frontend-design`, `frontend-design-codex`. Playwright is available locally; `js_repl` is not exposed, so browser work uses local Playwright scripts. No AI-generated marketing imagery is needed: actual product screens carry the visual story.

## 1. Reference research, before implementation

Primary sources inspected:
- [Samsung homepage](https://www.samsung.com/us/)
- [Galaxy Z Fold7](https://www.samsung.com/us/smartphones/galaxy-z-fold7/)
- [The Frame highlights](https://www.samsung.com/us/lifestyle-tvs/the-frame/highlights/)
- [OLED category](https://www.samsung.com/us/tvs/oled-tv/)
- [Shopify POS](https://www.shopify.com/pos) and [Polaris](https://shopify.dev/docs/api/polaris)
- [Stripe Payments](https://stripe.com/payments)
- [Geist typography](https://vercel.com/geist/typography) and [colors](https://vercel.com/geist/colors)
- [Linear](https://linear.app/), [Apple MacBook Pro](https://www.apple.com/macbook-pro/), [Material accessibility](https://m3.material.io/foundations/accessible-design/overview)

Samsung browser evidence: desktop 1440×900 and mobile 390×844, homepage, Fold7, and The Frame. Consent overlays affected early screenshots; composition underneath, DOM typography, scroll state, and subsequent captures are used together. The S26 Ultra page exceeded the text browser's response limit; Fold7 supplied the flagship product reference instead.

Useful observed principles:
- Product imagery occupies most of the scene; copy makes one point before the image supplies proof. A Fold7 desktop heading is 52px, narrative headings 48–80px. These are observations of that page, not a universal Samsung specification.
- Broad stages with generous gutters replace a continuous succession of small feature cards. The Frame uses environmental composition, then detail, then comparison.
- Compact product navigation remains available on scroll. Primary filled CTAs and secondary outlined/text actions have different emphasis.
- White/neutral scenes and dark media stages create chapter changes. The product crop changes materially on mobile, where copy sits above the product.
- Motion is concentrated around product media/reveals and sticky navigation. Browser animation counts do not establish every animation's intent; Ive uses only lightweight transitions with immediate content visibility.
- Samsung's large media and third-party consent/chat are not an Ive performance model. No Samsung assets, copy, brand styling, or exact scene layout is reused.

Supporting principles selected: Shopify's scan→bill→stock merchant workflow and precise capability descriptions; Stripe's adjacent software UI evidence; Geist's purposeful heading/copy scale, neutral surfaces, and contrast roles; Linear's precise interface presentation. Apple reinforces concise feature-by-feature storytelling. One Ive identity governs all of these influences.

SEO primary sources:
- [SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Software applications](https://developers.google.com/search/docs/appearance/structured-data/software-app)
- [Organization](https://developers.google.com/search/docs/appearance/structured-data/organization), [site names](https://developers.google.com/search/docs/appearance/site-names)
- [Robots](https://developers.google.com/search/docs/crawling-indexing/robots/intro), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Web Vitals](https://web.dev/articles/vitals), [Schema.org SoftwareApplication](https://schema.org/SoftwareApplication)

Use descriptive title/description and crawlable rendered content, real href links, one canonical per real page, and accurately described images near supporting copy. Robots is crawl guidance, not access control. Authentication remains the privacy boundary. Index only published public pages in the sitemap. WebSite markup identifies the site; SoftwareApplication can describe the real app but is not eligible for Google's software rich result without authentic offers and review data. No fabricated prices, reviews, or ratings. Breadcrumbs only on the deeper features page. Organization markup is omitted until publisher identity is established.

Search intent reviewed using Nepal retail/POS results including [Kuver Books](https://kuverbooks.com/nepal/pos-software-nepal), [Nistrax](https://nistrax.com/pos-software-nepal), and [Sajilo Billing](https://sajilobilling.com/). Inference from those results, not measured search volume: buyers evaluate billing, stock, outlets, pricing, support, and IRD readiness. Primary topic: POS software for retail stores in Nepal. Secondary topics: inventory management, shop billing, multi-store POS, registers, staff access, sales reports. Avoid restaurant/omnichannel/payment integration claims absent from this product. IRD integration is explicitly planned, not available or certified.

## 2. Product audit, before implementation

React 19 + TypeScript + Vite 8; React Query for app data; Lucide icons; Tailwind 4 and hand-authored CSS; some reusable UI primitives. Routing is based on public pathname/tenant host and app state. Hosting uses GitHub Pages build output at `/`, with custom domain `ivepos.me` in current product configuration.

Preserve user changes: the frontend worktree already contains modified auth/app/main/index and untracked public files. Changes must build on those files without reverting their work.

Identity: existing Ive mark/wordmark, forest green (#193c32 public, #1c5744 app), pale green-gray surfaces, compact 7–14px app radii. Existing font stack specifies Inter but no Inter file is loaded. Use the established system sans stack without remote font requests; give marketing typography its own weights, tracking, and scale.

Actual implemented surfaces:
- Terminal: product name/SKU/barcode search, piece and gram units, pack presets, cash bills, discounts, receipts, register selection. Cash only; no claims about wallets/cards/offline checkout.
- Inventory: catalog, receive/opening stock, quantity and low-stock status per store, movements, product price history.
- Stores/registers: location identities, receipt details, multiple registers, activation, organization limits.
- People/access: invitations, roles, permission overrides, assignments by store, verified authorization for sensitive changes.
- Reports: business day, sale count, cash collected, estimated gross profit based on recorded cost, bill list, critical stock. No fabricated charts or growth claims.
- Organization settings and profile/security: brand/settings, account verification, authenticator MFA and backup codes.
- Platform dashboard exists but is administrative; the public site should feature merchant operations instead.

Why the old page looks generic: stock retail photo dominates product proof; rotated receipt ornament; synthetic three-row previews; repeated pale green backgrounds; similar small section rhythm; scarce actual capability detail; workflow tabs conceal most content. No clear public onboarding/contact sales flow beyond existing sign-in/create-account and workspace finder.

SEO audit: duplicate descriptions; empty initial React root; no canonical/OG/Twitter/schema/robots/sitemap; app imports and CSS loaded eagerly on the homepage. Existing favicon/brand assets can be reused. Large retail PNG remains on sign-in but is removed from landing load.

## 3. Design system, defined before implementation

Concept: **The store, in view** — a quiet product showroom grounded in an operational retail interface.

- Type: existing system sans family; 400 body, 500 labels, 600/650 display. Display 88px large desktop, 68px laptop, 48px tablet, 44px mobile; H2 60/48/36px; H3 22–26px; body 16–18px; captions 12px. Tight display tracking, readable body leading. Semantic tags independent of style.
- Grid: 1280px content maximum, 48px desktop gutters, 32px tablet, 20px mobile. 12-column conceptual desktop grid; 4-column mobile. Product stages can widen to 1360px with 24px exterior gutters.
- Spacing: 4/8/12/16/24/32/48/64/80/112. Major desktop scenes 96–112px padding; mobile 56–64px, no forced viewport height.
- Colors: white #fff, warm neutral #f6f7f2, forest #193c32, dark #102c24, muted #54665d, sage #e8eee4, accent lime #d7e9a4. Lime is a small CTA/label accent, not a gradient.
- Backgrounds: white overview → dark checkout → warm white inventory → sage stores → white people → forest reports → white Nepal/next step. Individual scenes have different composition, not just different colors.
- Borders: 1px quiet structural rules and authentic screenshot edges. Radius: 8px controls, 12px screenshot frames, 0px sections. Elevation only for product stage separation; no arbitrary floating objects.
- Product photography: browser screenshots of actual components populated with deterministic illustrative fixture data, no private production records. Captions identify sample data. WebP assets, intrinsic dimensions, focused mobile crops. Hero eager/high priority; later images lazy. Full detail screens can be opened through real asset links.
- CTA: forest/lime filled primary action to existing `/login` flow; underlined secondary explore link. No invented demo booking, free trial, customer endorsements, or prices.
- Navigation: compact sticky header; real section/deeper-page links; native disclosure on mobile with Escape/close behavior. Workspace finder preserved in final section.
- Motion: 160–220ms native color/opacity transitions, no intro delays, no scroll hijacking, no per-section entry animations. Reduced-motion removes transitions and smooth scrolling.
- Responsive: rewrite grids, scale display deliberately, show detail crops rather than unreadably shrinking whole dashboards; reorder product/detail text where necessary; keep CTAs and section hints visible.

## 4. Page composition, defined before implementation

1. Header and product identity. Large left-aligned “Your store. All in view.” statement, concise Nepal/category copy, real inventory screen as a broad product stage. Literal product H1.
2. Chapter navigation via simple ruled links to sell/stock/stores/access/reports.
3. Dark checkout stage: “Keep the queue moving.” Real terminal, short scan/bill/receipt sequence, explicit cash scope.
4. Inventory: “Stock you can trust.” Large actual stock table with product/price/quantity/low-stock evidence. Smaller facts communicate weight/packs and price tracking.
5. Stores: “Every store. One view.” Existing store/register screen with concise centralized organization/assigned location explanations.
6. People and security: “A place for every person.” Actual permission editor; meaningful roles, granular access, store scope, MFA, and verification copy, without invented security certification.
7. Reporting: “Close the day with a clear picture.” Actual business-day report, cash and critical stock; honest cost-based gross profit estimate.
8. Nepal/product context and concise answers for genuine purchase questions, including future IRD status. Link to one substantive `/features` page organized into POS/inventory/stores/reporting/access anchors. Future standalone feature pages can reuse this content architecture when enough distinct content exists.
9. Clear CTA to existing account flow, preserved workspace finder, restrained product footer.

## QA inventory

Inspect 1440/1280/768/390/320 widths and screenshots of each scene. Verify hero product recognition/crops, alternate backgrounds and layout rhythm, readable screenshots, no decorative feature-card repetition. Exercise desktop anchors, mobile navigation including Escape and after selection, product-view controls if implemented, CTA routes, feature page/back navigation, workspace valid/invalid/reserved slugs, keyboard focus and reduced motion. Exploratory checks: JavaScript-disabled public content; long/invalid workspace input and minimum width.

Check production build/lint, static HTML without JS, exactly one H1, hierarchy/landmarks, link destinations, metadata/canonical/schema, robots/sitemap exclusion of private routes, image alt/dimensions/priority, console/network failures, accessibility and lab performance. Measure performance on production preview, not Vite development output. Lab LCP/CLS/TBT are evidence; INP requires real user traffic and cannot be guaranteed by a local run.
