# Login redesign

Concept: opening the store for the day. A dark forest storefront, large cream/lime lettering, a tilted screenshot of the actual terminal, and a receipt emerging from a printer slot. The form uses numbered labels, perforated rules, a decorative barcode, and a torn paper edge. The receipt feeds into place once; reduced-motion preferences disable that transition.

A dedicated `src/public/sign-in.css` scopes all changes to the login screen. The product screenshot uses sample data; no generated stock photo or invented business metrics are used.

The existing submit, recovery, signup, MFA, and organization-workspace flows remain connected to the existing callbacks. Organization logo/name/address and the platform sign-in link are preserved. Password visibility supports busy state and exposes its toggle state to assistive technology. Mobile uses a compact storefront header followed immediately by the receipt form.

Verification: production build, lint (existing unrelated warnings), and existing public server-render checks. Browser checks use simulated API responses and sample credentials, without contacting real accounts. Both platform and organization variants checked at 1440, 768, 390, and 320px. Checks cover overflow, clipped controls, missing/broken images, password visibility, all submitted fields, disabled/busy controls, invalid-login feedback, workspace validation, and organization signup visibility. Evidence: `frontend/artifacts/login/`.

## Single-screen revision

Login uses a `100svh` grid with reserved header/footer rows. The product stage shrinks to the remaining space; the receipt uses tighter spacing. Short viewports omit decorative receipt details and the mobile storefront banner while retaining every input and action. The organization workspace finder opens as an overlay instead of adding page height. Very short viewports (under 480px, including onscreen keyboards/zoom) retain natural scrolling so controls remain accessible.

Both variants verified at 1440×900, 1366×768, 1024×600, 768×1024, 390×844, 375×667, and 320×568. No document scrolling is needed at those sizes, including simulated invalid-login feedback and an expanded workspace finder; all active form controls remain in the viewport. Build, public-page checks, and lint completed successfully (existing unrelated lint warnings remain).
