# Design QA

Target: site-wide cookie consent

Reference: KVKK cookie consent requirement / first-visit consent pattern

Checks:
- Root layout now renders a site-wide cookie consent banner on first visit.
- Banner separates mandatory cookies from analytics and marketing categories.
- Users can reject non-essential cookies, accept all, or open the preference modal.
- New `/cerez-politikasi` legal page is public and linked from the banner and footer.
- Desktop and mobile first-visit Chrome screenshots show the banner without blocking primary navigation.
- `npm run lint` and `npm run build` pass.

Final result: passed

---

Target: `/arastirma/arastirma-notlari`

Reference: `/Users/furkancangi/Downloads/ChatGPT Image 8 Haz 2026 10_53_24.png`

Checks:
- Page now uses an archive-style research notes layout with hero illustration, category filters, evidence filters, search, sort, article cards, pagination, and research collaboration CTA.
- The content stays scientific and clinical; DNA Labs and product-development language are not mixed into the research notes page.
- Category, evidence, search, sort, pagination, and bookmark controls render as interactive UI.
- Desktop and 390px mobile Chrome checks show no horizontal overflow.
- `npm run lint` and `npm run build` pass.

Final result: passed

---

Target: `/dna-nedir/testler`

Reference: `/Users/furkancangi/Downloads/ChatGPT Image 8 Haz 2026 10_35_25.png`

Checks:
- Page is redesigned as a clinical evaluation tools surface, not a dense table or separate profile concept.
- Hero uses the requested tests and scales messaging with a soft clinical form mockup.
- Assessment areas, evaluation flow, upcoming tools, and contact CTA use the DNA cyan, blue, violet, and navy palette.
- No `DNA Profile`, age details, cut-off language, diagnosis claim, or automatic decision claim is used on the page.
- Shared header and footer remain intact.
- Desktop and 390px mobile Chrome screenshots show the hero, tool cards, flow, upcoming tools, and CTA without horizontal overflow.
- `npm run lint` and `npm run build` pass.

Final result: passed

---

Target: `/iletisim`

Reference: `/Users/furkancangi/Downloads/ChatGPT Image 8 Haz 2026 10_26_04.png`

Checks:
- Page now uses a split contact hero with DNA Intelligence messaging on the left and a large contact form panel on the right.
- Contact cards, form fields, paper-plane icon language, and soft cyan/lavender background match the requested reference direction.
- Existing shared header and footer remain in place.
- Desktop and forced 390px mobile Chrome checks show no horizontal overflow.
- `npm run lint` and `npm run build` pass.

Final result: passed

---

Target: `/dna-nedir/ai-raporlama`

Reference: `/Users/furkancangi/Downloads/ChatGPT Image 8 Haz 2026 10_07_51.png`

Checks:
- Hero uses the requested AI reporting message and a ham veri to klinik rapor flow.
- Visual language keeps the DNA cyan, blue, violet, navy palette on a white soft-gradient surface.
- Report content is shown as a large report mockup with side explanations instead of a dense card grid.
- Human + AI collaboration clearly states that the final decision remains with the therapist.
- Desktop and 390px mobile checks show no horizontal overflow.
- `npm run lint` and `npm run build` pass.

Final result: passed

---

Target: `/cozumler`

Reference: `/var/folders/7j/kgq_1qrj27n39d0yjmkfh1_40000gn/T/TemporaryItems/NSIRD_screencaptureui_VZuaD8/Ekran Resmi 2026-06-08 10.15.45.png`

Checks:
- Hero visual no longer reads as an unfinished generic brain panel.
- The right visual now explains the DNA ecosystem as education, evaluation, DNA Intelligence, AI analysis, and therapist-approved reporting.
- White, cyan, blue, violet, and navy theme remains consistent with the rest of the marketing pages.
- Desktop and 390px mobile checks show no horizontal overflow.
- `npm run lint` and `npm run build` pass.

Final result: passed

---

Target: `/dna-nedir/gelecek-moduller`

Reference: `/Users/furkancangi/Downloads/ChatGPT Image 8 Haz 2026 10_17_15.png`

Checks:
- Page now uses a DNA Labs / future modules concept instead of the default white card layout.
- Hero stays light and includes the requested clinical limitation notice.
- Module journey uses dark navy premium cards with cyan, blue, and violet accents.
- Clinical flow uses connected round nodes on a white, soft-gradient surface.
- Final CTA uses a dark gradient and DNA Labs roadmap language without diagnosis or automatic decision claims.
- Desktop and 390px mobile Chrome headless screenshots show no hero text clipping or module card overlap.
- `npm run lint` and `npm run build` pass.

Final result: passed
