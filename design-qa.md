# DNA Intelligence Page Design QA

## Scope

- Route: `/dna-nedir`
- Selected visual source: `/Users/furkancangi/.codex/generated_images/019ecfb7-080f-7730-8baf-3ef7e620363f/exec-acabe6a1-844c-474e-839d-3a6e2820583f.png`
- Desktop lower-section capture: `.tmp/design-qa/dna-nedir-desktop-v2.png`
- Mobile model-section capture: `.tmp/design-qa/dna-nedir-mobile-v2.png`
- Full comparison: `.tmp/design-qa/dna-nedir-comparison.png`
- Focused hero comparison: `.tmp/design-qa/dna-nedir-comparison-hero.png`
- Desktop verification viewport: `1280 x 720`
- Mobile viewport: `390 x 844`
- Interaction state: default page state with focused checks on the clinical pathway and model bridge

## Visual Comparison

The selected hero direction was preserved. The two lower layers were then inspected separately at desktop and mobile sizes after user feedback identified the dark workflow strip and text-heavy model section as the weak parts of the page.

### Fidelity

- **Layout:** The first layer remains unchanged: compact shared header, left-aligned decision statement, and right-side radial regulation map. The second layer is now one connected clinical pathway; the third is one continuous two-column model bridge with an integrated outcome strip.
- **Typography:** Heading hierarchy, line breaks, weight, and density match the selected direction. Supporting text is intentionally product-specific Turkish copy and remains short enough to preserve the reference rhythm.
- **Color:** White clinical surface, light neutral pathway band, navy typography, and restrained cyan/blue/purple accents maintain the selected clinical palette. Dark navy is reserved for the final shared outcome rather than an entire navigation-like band.
- **Imagery:** The production DNA Intelligence brand asset is used as the regulation core. No placeholder or generated substitute remains in the implementation.
- **Icons:** Existing Lucide icons are used consistently for semantic UI signals and workflow steps. Stroke weights and sizes remain visually coherent.
- **Surfaces:** The hero stays unframed. The workflow uses a shared line instead of separate cards, while the model distinction uses one continuous canvas and one outcome strip.
- **Responsive behavior:** At `390 x 844`, the pathway becomes a vertical timeline and the model bridge becomes a linear sequence. Document and viewport widths both remain `390px`; no horizontal overflow or overlapping production content was detected.

## Interaction And Accessibility Checks

- `Nasıl çalışır` resolves to `#klinik-akis` and moves to the workflow band.
- `Eğitim modeli` points to `/dna-nedir/egitim-programi`.
- Header navigation retains its existing keyboard-accessible links and menu buttons.
- The regulation image has descriptive alt text; decorative icons are hidden from assistive technology.
- Desktop and mobile document widths match their viewport widths; no horizontal scroll was detected.
- Browser console errors and warnings: none.
- TypeScript lint: passed.
- Production build: passed after the lower-section redesign.

## Comparison History

### Iteration 1

- **P2 - Header density:** The shared header initially used the full marketing height and the longer `DNA Intelligence Nedir?` label, reducing the reference hero's open space.
- **Fix:** Added a route-scoped compact header mode and shortened only this route's visible navigation label to `DNA Intelligence`.
- **Post-fix evidence:** `.tmp/design-qa/dna-nedir-desktop.png` and `.tmp/design-qa/dna-nedir-comparison-hero.png`.

### Iteration 2

- **P2 - Lower-layer hierarchy:** The dark four-step strip resembled navigation and the following two-column explanation repeated too much copy.
- **Fix:** Replaced the strip with a light connected clinical pathway. Combined model distinction, shared outcome, and actions into one structured section with shorter labels and no duplicate final CTA.
- **Post-fix evidence:** `.tmp/design-qa/dna-nedir-desktop-v2.png` and `.tmp/design-qa/dna-nedir-mobile-v2.png`.

## Remaining Notes

- **P3:** The small Next.js development indicator visible in the local captures is development-only and is absent from production builds.
- The implementation intentionally uses the existing production logo and shared marketing header rather than duplicating the reference as a separate one-off component.

No unresolved P0, P1, or P2 findings remain.

final result: passed
