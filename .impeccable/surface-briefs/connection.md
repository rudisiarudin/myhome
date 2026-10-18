# MyHome connection flow

Targets: src/features/connection/ConnectionRoot.tsx, src/features/connection/connection.css, src/features/account/ProfileAvatar.tsx

Mode: Operate. The user approved connecting the existing app to their Supabase schema, including email login, account profile/avatar, a two-person household invitation and persistent household records. Existing five-tab UI and forms remain intact. No fictitious data is seeded into live households. The user selected antislop during implementation.

Typography follow-up: the user requested smaller fonts and a push. Access headings are now 24px semibold (22px narrow); dominant page/greeting, wallet/bill, decision, calendar and editor roles were reduced in their existing CSS. Already-small metadata, Poppins, layout, colors, tap targets and 16px mobile input sizes are preserved. No new assets or behavior changes.

## Direction contract

THESIS: extend MyHome with a short email-account and household setup flow, not a separate marketing landing page. Returning users go straight to their own household after session restoration.

OWN-WORLD: preserve white/charcoal/lavender, self-hosted Poppins, rounded shell, standard labeled fields and the existing theme toggle. ENERGY 2 / RHYTHM 2 / MOTION 1. No new visual assets, illustrations or invented account photos.

STORY: sign in or register, confirm email if required, create a household or paste an invitation, then use real empty states. Connection failures explain recovery without falling back to sample records.

FIRST VIEWPORT: compact wordmark and theme control at the top; a single readable form capped at 420px below a short heading. Primary action follows fields; secondary recovery/account actions stay below. Mobile stacks the same flow without navigation before authentication.

FORM: precisely scoped extension of the established household interface, code-led. No new-world selection or concept seed is needed. The signature is the transition from personal profile to the shared household, with member initials reused in the existing app.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
