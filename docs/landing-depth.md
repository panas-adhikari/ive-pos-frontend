# Landing page and product captures

The October 8 revision replaces tightly cropped panels with full application views and gives the public page a physical retail-workspace theme. Forest green, cream, sage, and the existing Ive mark remain the visual identity. The hero layers the actual inventory and terminal screens with an illustrative receipt; subsequent chapters cover cash sales, stock, stores/registers, staff permissions, and business-day reports. The final action explains the current guided Quick setup flow.

Product frames have visible edges, directional shadows, and restrained perspective. Spring motion softens pointer tilt and a small amount of scroll movement. Content reveals run once. Anchor navigation scrolls smoothly. Reduced-motion preferences disable movement and keep frames flat. All content remains visible in server-rendered HTML, including without JavaScript.

## Screenshot source

`scripts/capture-product.mjs` opens the actual application and intercepts its API requests with deterministic illustrative Mountain Mart data. It rejects mutation requests. It captures the complete viewport with the real navigation and surrounding margins, without retouching, tight panel crops, or production account data. Desktop captures are 1440 × 1000 at 1.5× resolution; the terminal uses 1440 × 1200 to include checkout. Mobile captures are 390 × 1000 at 2× resolution; the terminal uses 390 × 1440 and scrolls the main area to its current bill. The receipt's three item amounts correspond to the sample terminal bill.

The capture script requires the existing Playwright installation and Python Pillow for lossless framing-preserving WebP encoding. Run from `frontend` with the production preview on port 4173:

```sh
node scripts/capture-product.mjs
npm run build
```

PNG originals and the capture manifest are in `artifacts/product-captures/`. WebP images are in `public/images/product/`. Intrinsic dimensions match the new captures. The primary hero image loads eagerly; workflow images load lazily. Full-screen links open the complete desktop captures. Shared feature and sign-in pages also use the refreshed imagery.

## Verification

Production build, lint, and existing public-page server-render checks pass. Lint retains existing application/auth warnings. Browser checks in `artifacts/landing-depth/check.mjs` cover desktop, tablet, and mobile widths (1440, 1280, 1024, 768, 390, 320), product image loading, overflow, clipped text, mobile navigation, pointer response, reduced motion, feature-page rendering, workspace validation and destination, and JavaScript-disabled HTML. Browser evidence and findings are in the same directory.

This revision supersedes the screenshot framing and perspective behavior described in the earlier showroom audit.
