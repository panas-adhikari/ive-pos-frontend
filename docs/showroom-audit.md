# Landing and features layout audit

Reference: `/image.png`, reviewed 6 October 2026.

## Findings

- The reference shows `/features`: long descriptions, four sentence-length bullets, a scope paragraph, and a second feature summary compete in the same section.
- Screenshots start with a 0.66 scale and a perspective tilt inside an already narrow column. Product details become difficult to read.
- The landing page shares this screenshot component and several split layouts, so the same problem carries across the public experience.
- Repeated summaries make the visitor read before they can see the product.

## Implemented layout

- Removed marketing paragraphs from the landing and features pages, including the repeated screenshot summary.
- Rebuilt sections as a chapter label, brief heading, short capability labels, and a broad screenshot underneath.
- Removed the copy-heavy screenshot toggle. Screenshots open their full image in a new tab. A subsequent visual revision restores 3D perspective, alternating tilts, frame thickness, and directional shadows; desktop hover/focus straightens the image, and mobile uses a gentler angle.
- Landing screenshots use the full content width (1280px maximum). The portrait permissions screen uses a 900px maximum to avoid an excessively tall image.
- Retained actual product images, focused mobile assets, sample-data captions, lazy loading, image dimensions, section anchors, sign-in, and workspace entry.
- Cash-only billing and estimated profit remain explicit in short labels. Nepal IRD integration remains marked as planned.
- Replaced the long Nepal availability section with one brief planned-integration label next to the final action.

Browser evidence and automated layout findings are in `frontend/artifacts/showroom/`.

## Verification

- Production build and existing public-page server-render checks passed.
- Lint completed with existing warnings in unrelated application/auth files.
- Production-preview checks passed at 1440, 768, 390, and 320px on both pages: no horizontal overflow, clipped text, marketing paragraphs, broken images, missing image alt text, or browser errors.
- Mobile navigation closes after selecting a link. Invalid workspace addresses show validation feedback.
- Screenshots retain nearly the full content width, with inset perspective stages to accommodate tilted corners. Mobile product images use focused crops.
- Screenshots were captured after image decoding and inspected on desktop and mobile.
