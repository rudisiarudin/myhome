---
name: MyHome
description: Poppins household UI with light/dark themes, rounded cards, and five-item bottom navigation.
colors:
  ink: "#2c2c2b"
  white: "#fff"
  muted: "#696967"
  lavender: "#f1f2fa"
  line: "#ededed"
  focus: "#526a79"
  outer-canvas: "#dfe4ec"
  shopping-surface: "#fafafa"
  field-border: "#e9e9ed"
  button-hover: "#474745"
  button-white-hover: "#e5e5e5"
  error: "#973e3e"
  dock-light: "#f8f8fc"
  dock-mobile-light: "#f7f7fb"
  dark-canvas: "#111216"
  dark-surface: "#1b1c21"
  dark-text: "#e9e9ee"
  dark-muted: "#adaeb8"
  dark-lavender: "#262733"
  dark-line: "#303138"
  dark-focus: "#b6cadb"
  dark-feature: "#303137"
  dark-control: "#2b2c34"
  dark-field-border: "#454754"
  dark-primary: "#e5e5ee"
  dark-primary-text: "#24242b"
  dark-selected: "#e7e7ee"
  dark-selected-text: "#25252d"
  dark-category-text: "#25252e"
  dark-dock: "#25262f"
  dark-active: "#f0f0f7"
  dark-error: "#ffb2b2"
  workspace-text: "#2c2c2b"
  workspace-fill: "#f6f6f8"
  workspace-border: "#e3e3e9"
  workspace-action: "#2c2c2b"
  workspace-on-action: "#fff"
  workspace-positive: "#3d6e4d"
  dark-workspace-text: "#e9e9ee"
  dark-workspace-fill: "#282a34"
  dark-workspace-border: "#484b59"
  dark-workspace-action: "#e5e5ee"
  dark-workspace-on-action: "#25252e"
  dark-workspace-positive: "#b6d4be"
  danger-hover: "#7c3030"
  dark-on-danger: "#402329"
  dark-danger-hover: "#ffcece"
  avatar-background: "#e5e5e9"
  avatar-ink: "#37373c"
typography:
  headline:
    fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-.5px"
  title:
    fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-.3px"
  body:
    fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.45
  label:
    fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 600
  amount:
    fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-1px"
  amount-mobile:
    fontSize: "32px"
  amount-narrow:
    fontSize: "30px"
  amount-long:
    fontSize: "26px"
  balance-mobile:
    fontSize: "23px"
  editor-title:
    fontSize: "21px"
    fontWeight: 600
  preview-narrow:
    fontSize: "9px"
  metadata:
    fontSize: "10px"
  supporting-control:
    fontSize: "11px"
    fontWeight: 500
  search:
    fontSize: "14px"
  compact-amount:
    fontSize: "15px"
  field-mobile:
    fontSize: "16px"
  calendar-section-mobile:
    fontSize: "16px"
  agenda-mobile:
    fontSize: "16px"
  editor-title-narrow:
    fontSize: "18px"
    fontWeight: 600
  editor-title-mobile:
    fontSize: "20px"
    fontWeight: 600
  wallet-amount:
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "-.6px"
  budget-amount:
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "-.6px"
  wallet-amount-mobile:
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "-.6px"
  bills-total:
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-.6px"
  payment-amount:
    fontSize: "26px"
    letterSpacing: "-.6px"
  pocket-amount:
    fontSize: "clamp(16px, 4.8vw, 22px)"
    fontWeight: 650
    letterSpacing: "-.4px"
rounded:
  input-detail: "4px"
  segment: "11px"
  control: "12px"
  tile: "13px"
  field: "14px"
  button: "15px"
  save: "16px"
  row: "17px"
  panel: "22px"
  wallet: "24px"
  dock: "27px"
  feature: "29px"
  dialog: "30px"
  shell: "36px"
  circle: "50%"
spacing:
  compact: "9px"
  row: "13px"
  pair: "12px"
  inset: "18px"
  card: "22px"
  mobile-gutter: "24px"
  dialog-inset: "28px"
  columns: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "12px 17px"
  button-primary-hover:
    backgroundColor: "{colors.button-hover}"
  button-white:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "12px 17px"
  button-white-hover:
    backgroundColor: "{colors.button-white-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "#666664"
    padding: "0"
  button-icon:
    backgroundColor: "transparent"
    rounded: "{rounded.tile}"
    size: "44px"
  input-field:
    backgroundColor: "transparent"
    textColor: "{colors.workspace-text}"
    rounded: "{rounded.tile}"
    padding: "13px"
    height: "50px"
  input-field-dark:
    textColor: "{colors.dark-workspace-text}"
  card-pocket:
    backgroundColor: "{colors.lavender}"
    rounded: "{rounded.panel}"
    padding: "18px"
  card-wallet:
    backgroundColor: "{colors.lavender}"
    rounded: "{rounded.wallet}"
    padding: "19px 21px 12px"
  card-wallet-dark:
    backgroundColor: "{colors.dark-lavender}"
    textColor: "{colors.dark-workspace-text}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.workspace-text}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    typography: "{typography.supporting-control}"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.workspace-fill}"
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.white}"
    rounded: "{rounded.tile}"
    padding: "12px 18px"
    height: "47px"
  button-danger-hover:
    backgroundColor: "{colors.danger-hover}"
  button-danger-dark:
    backgroundColor: "{colors.dark-error}"
    textColor: "{colors.dark-on-danger}"
  button-danger-dark-hover:
    backgroundColor: "{colors.dark-danger-hover}"
  transaction-selected:
    backgroundColor: "{colors.workspace-action}"
    textColor: "{colors.workspace-on-action}"
    rounded: "{rounded.segment}"
    height: "44px"
  transaction-selected-dark:
    backgroundColor: "{colors.dark-workspace-action}"
    textColor: "{colors.dark-workspace-on-action}"
  compact-money:
    backgroundColor: "transparent"
    textColor: "{colors.workspace-text}"
    rounded: "{rounded.tile}"
    padding: "0 13px"
    height: "50px"
  category-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.tile}"
    padding: "12px 13px"
  amount-entry:
    backgroundColor: "{colors.lavender}"
    rounded: "{rounded.panel}"
    padding: "20px 22px 17px"
  button-primary-dark:
    backgroundColor: "{colors.dark-primary}"
    textColor: "{colors.dark-primary-text}"
    rounded: "{rounded.button}"
    padding: "12px 17px"
  button-primary-dark-hover:
    backgroundColor: "{colors.white}"
  button-record:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.tile}"
    padding: "8px 12px"
  category-selected-dark:
    backgroundColor: "{colors.dark-primary}"
    textColor: "{colors.dark-category-text}"
    rounded: "{rounded.tile}"
    padding: "12px 13px"
  amount-entry-dark:
    backgroundColor: "{colors.dark-lavender}"
    rounded: "{rounded.panel}"
    padding: "20px 22px 17px"
  theme-toggle:
    backgroundColor: "#f3f3f5"
    rounded: "{rounded.tile}"
    size: "44px"
  theme-toggle-dark:
    backgroundColor: "{colors.dark-control}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.tile}"
    size: "44px"
  navigation:
    backgroundColor: "{colors.dock-light}"
    rounded: "{rounded.dock}"
    padding: "9px 16px"
  navigation-dark:
    backgroundColor: "{colors.dark-dock}"
    rounded: "{rounded.dock}"
    padding: "9px 16px"
---

# Design System: MyHome

## Overview

**Creative North Star: "White and charcoal, rounded cards and bottom navigation"**

The user's supplied reference defines this calm, readable household interface. Charcoal establishes emphasis, white keeps everyday records open, and pale lavender distinguishes secondary containers without competing with the content. This document records the implemented system, not a replacement direction.

The user-selected Poppins family serves all application typography. Household initials and semantic icons provide recognition without invented profile photography or display artwork. The reference defines the light theme; the user's explicit follow-up adds a matching dark theme. The surface brief retains ENERGY 2 / RHYTHM 2 / MOTION 1.

The production entrypoint extends this same visual language with email Auth, profile initialization, household create/join, and the existing five-tab workspace. Household records persist in Supabase's `myhome` schema, with RLS and transactional finance RPCs; new households start empty rather than receiving sample records. This is an ordinary extension of MyHome, not a new visual world. Existing in-memory preview providers remain test/development fixtures only and are never a fallback for failed production connections. Banking, money movement, and photo/document storage uploads remain outside scope.

**Key Characteristics:**
- White/charcoal light surfaces and near-black/charcoal dark surfaces with lavender secondary grouping.
- Rounded feature cards beside flat, divided record lists.
- Large monetary figures, household initials, and semantic inline icons.
- Five equal-width bottom destinations; expense entry stays in the home allowance summary and budget page.

## Colors

The palette is predominantly neutral; lavender provides a quiet secondary surface rather than a bright action accent. Frontmatter values are normative; the sidecar's synthesized tonal ramps are preview metadata, not additional shipping colors.

### Primary
- **Charcoal ink:** light-theme primary text, selected controls, feature cards, progress fills, and save actions. This primitive remains unchanged in dark mode; component overrides handle dark text and surfaces.

### Neutral
- **White:** main canvas, dialog, and reversed text on charcoal.
- **Muted gray:** supporting copy, dates, and row metadata.
- **Pale lavender:** shopping shortcuts, pocket cards, and the amount-entry container.
- **Cool outer canvas:** the desktop surround, removed on mobile.
- **Shopping surface, line, and field border:** quiet row grouping and dividers rather than per-row elevation.
- **Slate focus:** visible keyboard outlines, not a brand accent.
- **Error red:** validation and destructive feedback only, not a primary action color.

The `dark-*` frontmatter entries record the implemented dark overrides. Near-black canvas surrounds the charcoal shell and dialog; feature cards are a lighter charcoal, and lavender becomes a dark tinted secondary surface. Dark body text, muted copy, dividers, and keyboard focus replace the corresponding light roles. Primary actions and selected controls invert to light fills with dark text; the dock's active label, icon, and dot use the dark-active token. Dialog field borders and validation text also have explicit dark variants.

### Semantic workspace roles
`src/features/household/Workspace.css` defines the six `--workspace-*` variables. Frontmatter records each light value under the matching name and each dark value under `dark-workspace-*`; these are semantic aliases, not extra brand colors.

| CSS variable | Application |
| --- | --- |
| `--workspace-text` | Labeled fields, wallet symbols, search, secondary actions, and empty-state titles. |
| `--workspace-fill` | Transaction-kind track, finance-action icon tiles, filter controls, native select options, and secondary hover. |
| `--workspace-border` | Editor fields, search, secondary actions, budget limits, calendar date control, and bill-action separator. |
| `--workspace-action` | Selected transaction kind, emphasized outgoing icon tile, and agenda checkbox accent. |
| `--workspace-on-action` | Text/icons on those selected fills. |
| `--workspace-positive` | Income amount and incoming transaction icon only. |

Error/danger tokens remain feedback-only: error text, overspent budget values, deletion hover, and confirmation actions. Danger confirmation uses error/white in light mode, dark-error/dark-on-danger in dark mode, and the corresponding danger-hover token. These reds and the income green are semantic feedback, not a palette expansion. Existing `--lavender`, `--muted`, `--line`, and `--focus` continue to resolve with the active theme.

Theme state is applied through `data-theme` on the document root and the native `color-scheme`. A saved valid `myhome-theme` value wins on startup; otherwise the initial OS preference decides. The header toggle updates the whole interface, including login, onboarding, and dialogs, and stores the resolved choice when localStorage is available. Storage failure does not prevent switching. There is no ongoing OS-change listener or separate system-mode option. Theme preference storage is independent of household-record persistence in Supabase.

**The Contrast Rule.** Charcoal and white establish primary emphasis; lavender supports secondary grouping rather than replacing selected-state contrast.

## Typography

One inherited Poppins stack serves headings, labels, fields, and figures, with system sans fallbacks. The user-selected font is self-hosted in `public/fonts/poppins-latin-{400,500,600,700}.woff2`: normal style, Latin coverage, `font-display: swap`, and `font-synthesis: none`. `index.html` preloads weights (400) and (700) with anonymous cross-origin font requests; the files remain same-origin. `public/fonts/OFL.txt` and `public/fonts/README.md` retain the license and provenance. There is no separate display family. The frontmatter's body role describes record titles, not a universal body override: surrounding supporting copy uses regular weight and smaller sizes. Some inherited CSS requests (650) remain; the wordmark now uses (700), and compact amount/editor roles use (600). The supplied static faces remain the four listed weights.

- **Headline:** page headings use (24px / 1.3, 700), reducing to (22px) on mobile, tracking (-.5px).
- **Login/onboarding heading:** compact Poppins (24px / 1.35, 600), tracking (-.5px), reducing to (22px) through (359px).
- **Greeting:** (24px / 1.25, 700), reducing to (22px) on mobile and (20px) below the narrow breakpoint. Narrow-screen rules no longer enlarge the greeting or daily allowance figure.
- **Section title:** the title token separates task groups; record titles are deliberately quieter.
- **Body and metadata:** task copy is generally (12–14px), supporting metadata (10–12px), and dock labels (9px desktop / 8px mobile).
- **Monetary entry:** (36px) desktop, (32px) mobile, (30px) through (359px). More than nine raw digits switches to (26px) desktop, (24px) mobile, or (22px) through (359px). Money and times use tabular numerals.

The user requested smaller typography after the connected app shipped. Dominant headings, wallet/bill totals, calendar/composer headings, and editor amounts now use the compact sizes above, while existing body/metadata sizes, control hit areas, and 16px mobile form fields remain unchanged. The mobile decision-card heading stays at (20px), rather than increasing to (27px). This reduces visual bulk without shrinking tap targets or triggering input-focus zoom on mobile Safari.

The workspace roles in frontmatter record actual component density, not a new global type scale. All inherit Poppins; weights and line heights not specified by a role remain contextual. The extension's observed sizes map as follows:

| Size | Implemented role |
| --- | --- |
| 9px | Narrow workspace status banner and existing narrow supporting labels. |
| 10px | Workspace status, field hints, wallet ownership, transaction metadata, agenda completion, budget context; narrow history amounts. |
| 11px | Secondary actions, transaction-kind controls, filters, payment context; mobile history amounts. |
| 12px | Visible field labels, finance actions, form hints, calendar date, and feedback. |
| 13px | Editor field text and wallet titles; desktop transaction titles/amounts retain existing body sizing. |
| 14px | History search. |
| 15px | Compact rupiah digits and empty-state titles. |
| 16px | Mobile fields/compact money, section headings, mobile managed agenda, payment-summary title. |
| 18px | Composer headings, narrow editor heading and budget remainder. |
| 20px | Mobile editor, desktop managed agenda, decision heading, mobile budget remainder, narrow greeting. |
| 21px | Desktop editor heading and mobile daily allowance. |
| 22px | Wallet balance, bill amount, desktop budget remainder, mobile page/greeting and narrow access headings. |
| 23px | Mobile total wallet balance. |
| 24px | Desktop page/greeting/access heading, total balance and unpaid-bills summary; long mobile amount. |
| 26px | Bill-recording payment amount and long desktop amount entry. |
| 30px | Narrow standard amount entry. |
| 32px | Mobile standard amount entry. |
| 36px | Desktop standard amount entry. |

Pocket money uses the exact `pocket-amount` clamp at every viewport inside the budget workspace, overriding older fixed pocket sizes. This keeps final digits together in the two-column cards; `min-width: 0` and overflow wrapping remain defensive. Do not replace it with the superseded (20px/22px) rules.

## Layout

Desktop has an outer inset (32px vertical / 24px horizontal), a centered white shell capped at (1040px), and shell padding (0 38px 114px). The header is (91px) tall. The home work area uses (1.12fr 1fr) columns with a (42px) gutter; recent transactions span that grid. Calendar content is capped at (650px). Reusable household workspaces now supply the finance, calendar, bills, goals, and transaction views; older detail/expense-grid CSS is not their layout recipe.

Login and household onboarding use a compact version of the same shell, capped at (720px), with (36px) corners, (32px) vertical margins, and padding (0 38px 24px). The wordmark and existing theme control occupy its (91px) header; one form column capped at (420px) follows, with content margins (38px auto 64px). The primary action follows labeled fields; account/recovery actions sit below. There is no five-tab navigation before household access. Through (759px), this shell fills at least the viewport height, drops its margin/corners, uses (24px) horizontal insets and an (82px) header, and brings the form top margin to (32px); through (359px), insets reduce to (18px). These are local access-flow dimensions within the established composition.

At widths up to (759px), the surround disappears and the shell becomes square-edged, capped at (500px), with padding (0 24px 115px). Home sections stack; bills and decision cards become one column. Shortcuts, pocket cards, six category radios, and the seven-day strip retain their compact grids. Payment summaries change from one desktop column to two mobile columns. The header reduces to (82px).

Wallets use three columns by default, two from (600px) through (899px), and one through (599px). Wallet padding changes from (19px 21px 12px) to (16px 20px 10px) in that last range. Daily/monthly budget and pocket cards remain two-column, as do paired editor fields. History filters use three columns, changing to two through (599px), with month spanning both. At that breakpoint transaction dates stack and metadata loses its desktop left indent. Calendar week/date controls sit above seven native day buttons; through (399px) the strip expands into its side margins to retain (44px) day targets.

Calendar creation is directly visible in an outlined composer, followed by the agenda in DOM order. Above (899px), composer and timeline share equal columns with a (32px) gap; through (899px) they stack. The composer has (24px) corners and (23px) padding, changing to (22px) corners and (20px 18px) padding through (599px). Its paired date/time fields stack through (359px) so native controls remain readable.

Urusan Rumah uses the same outlined composer before its record list. Desktop columns are (1fr 1.05fr) with a (32px) gap, stacking through (899px). Composer insets and corners match the calendar composer. Bills inside this work area use one column at every width; document/contact records stay flat with divided action footers. A tab change swaps the visible form and list together.

Below (360px), shell gutters reduce to (18px), dialog gutters to (19px), and selected type/icon sizes compress. Page-heading avatars and the greeting signature are hidden, but the five navigation destinations remain present. The document body has a minimum width of (320px).

The desktop dock floats (20px) above the viewport, capped at (620px), with width (100% - 64px) and minimum height (82px). Its grid is `repeat(5, 1fr)` at every viewport: navigation only, no centered add action. Mobile docks to the bottom, capped at (500px), with minimum height (85px) and safe-area-aware bottom padding. Content reserves bottom space; notices sit above the dock. The home allowance footer aligns spending context with its Catat button; Keuangan has Pemasukan/Pengeluaran/Transfer actions and a Catat baru history action. Header actions now group the account avatar and theme button with a (10px) gap, reducing to (7px) below (360px); the old visible role segments are retired.

## Elevation & Depth

Cards and ordinary records are flat: tonal contrast, spacing, and thin dividers carry most hierarchy. Shadows are restricted to the fixed dock and modal. Exact light desktop/mobile dock shadows, the dark dock shadow, and the dialog shadow live in the sidecar. Dark mode uses the same dock shadow at every width. The dialog uses a theme-specific translucent backdrop, not backdrop blur.

**The Flat Records Rule.** Expense, document, and contact rows use dividers rather than individual drop shadows.

Feedback transitions are short: most controls use (.18s ease), category tiles (.15s ease), and progress (.25s ease-out). Shortcut hover lifts by (-3px), with scale feedback on press. Only the randomizer spins (.7s linear infinite) while choosing. Reduced-motion preferences collapse animation and transition durations to (.01ms).

## Shapes

Large containers are generously rounded; controls use tighter corners so the hierarchy does not become uniformly pill-shaped. Greeting and dialog use the dialog radius, shortcuts/balance/decision cards use the feature radius, pocket and amount containers use the panel radius, and shopping rows use the row radius. Wallet cards use the wallet radius; transaction-kind segments use the segment radius. The input-detail radius belongs to amount digits and the mobile sheet handle, not outer cards. Household initials and the dialog close control are circular. The content-level Catat button and square theme control use the tile radius; neither is a circular dock action.

Mobile feature corners adjust locally: greeting (29px), shortcuts (28px), dock (25px 25px 0 0), and dialog (28px 28px 0 0). Inputs and category tiles use thin borders; decorative cards clip their inline wave artwork.

## Components

### Buttons
- Light-theme primary buttons are charcoal with white text, minimum height (49px), and the frontmatter's button padding. White variants invert this on charcoal decision cards; text actions remain unfilled. Dark-theme primary buttons use a light fill and dark text, with white hover. Icon-only controls are (44px) square.
- The home Catat action has minimum height (44px), minimum width (83px), padding (8px 12px), a plus icon (16px), and no independent dock slot. Its dark variant uses background (#e5e6ee), text (#26272e), and white hover.
- Hover changes tone; primary press scales to (.98). Disabled controls use opacity (.65) and a waiting cursor. Global keyboard focus is a (3px) theme-aware focus outline with (4px) offset.
- Secondary actions are transparent, bordered, and at least (44px) high, with workspace fill on hover. Destructive confirmation is a distinct danger button, at least (47px) high, paired with Batal in two equal columns. Both themes have explicit danger text/fill/hover combinations; ordinary save actions remain neutral.

### Cards / Containers
- Feature cards establish emphasis through charcoal or lavender, not repeated shadows. Pocket cards use the panel token and reduce padding to (17px) on mobile, (13px) below (360px).
- Shopping rows are rounded and compact, pale in light mode and charcoal in dark mode. Native checkbox state uses a charcoal completion box in light mode and a light completion box in dark mode, with struck-through completed text.
- The connected agenda combines a charcoal first event with quieter subsequent records. The current wave SVG is rendered in the greeting, compact home agenda's first event, and dark food-decision card; the reusable finance balance and managed calendar do not insert it. This is an observed placement inventory, not a change to the surface contract.
- Wallet cards use flat lavender surfaces, a semantic wallet-kind icon, ownership metadata, a large balance, an edit action, and a history chevron. Their balance derives from opening balance plus persisted household transactions, not a bank connection. Budget-limit cards use a border and progress rather than added elevation.

### Inputs / Fields
- Reusable labeled fields now supply transaction description, wallet/date/pocket selectors, wallet details, budgets, agenda, bills, documents, contacts, and goals. The description is a normal bordered field, not the retired receipt-icon wrapper. Fields have minimum height (50px), workspace border/text, transparent fill, tile corners, and (13px) padding. Mobile editor input/select/textarea text rises to (16px) through (599px). Select options use theme-aware workspace fill/text and inherit native color-scheme.
- Compact MoneyInput uses a bordered wrapper with Rp and tabular digits. Compact money, search, and large amount focus moves to the wrapper: (2px solid var(--focus)), offset (3px), instead of outlining the digits. Ordinary labeled inputs/selects retain global focus. Dark-theme inputs use `caret-color: currentColor`; textareas remain native resizable controls with their browser focus behavior.

### Navigation
- Only the five destinations occupy the fixed bottom dock, in equal columns; no Catat or add button is present there.
- Active destinations use charcoal in light mode or the dark-active token in dark mode, a small dot, and heavier icon stroke (2.6 versus 1.9). Labels remain visible. Sub-section controls invert from charcoal-on-pale tracks to light selected fills on dark tracks.
- Keuangan subpanes are Ringkasan, Dompet, and Riwayat; their buttons use `aria-pressed`, as do the three transaction-kind choices. They do not create extra bottom-nav destinations. History provides title search, wallet/kind/month filters, Reset filter, result count, and a genuine empty state. Income rows use semantic positive text/icons; transfers and savings stay separately labeled rather than appearing as household consumption.

### Theme Toggle
- A (44px) icon button beside the account avatar uses Moon in light mode and Sun in dark mode (20px). Its accessible label and title name the destination theme: Gunakan mode gelap or Gunakan mode terang. `aria-pressed` reports whether dark mode is active.
- Light default/hover fills are (#f3f3f5 / #e9e9ee); dark default/hover fills are (#2b2c34 / #383a46). Layout and typography stay unchanged across themes.

### Editor and Confirmation Sheets
- `Modal` in `src/features/household/ui.tsx` is the native dialog primitive for all household editors. Desktop is centered, capped at (470px), width (100% - 32px), with (28px) content padding and maximum height (100dvh - 32px). Mobile becomes a bottom sheet capped at (500px), with a visible handle, native scroll, safe-area padding, and maximum height (100dvh - 20px). Workspace horizontal insets become (22px) through (599px), then (18px) through (359px). Confirmation caps at (410px), including mobile.
- `TransactionForm` in `Dialogs.tsx` starts new non-saving entries with Keluar/Masuk/Transfer buttons, then large formatted IDR amount and title. Wallet/date fields follow; transfers add a destination wallet, savings add a goal, and expenses retain six category radios plus the budget/pocket selector. `MoneyInput` formats id-ID whole rupiah and accepts at most twelve raw digits. Current field IDs are `entry-amount`, `entry-title`, `entry-wallet`, `entry-date`, `entry-destination`, `entry-goal`, and `entry-pocket`; the radio group is `entry-category`.
- Expense category labels/icons remain Makan & dapur, Belanja rumah, Kencan berdua, Bensin & kendaraan, Hobi & personal, and Tagihan. Selected tiles reverse to white-on-charcoal in light mode or dark-on-light in dark mode and add a checkmark; keyboard focus outlines the visible tile. The recorder row retains household initial, identity, and selected date, followed by the full-width save action, minimum height (53px), with a checkmark rather than a navigation arrow.
- Wallet, budget, agenda, bill, and goal editors reuse `Field`, `MoneyInput`, and `FormEnd`, not copies of the removed App expense form. Wallet opening balances may be zero; new contributions select a funding wallet, while goal opening amounts do not debit one. Bill recording displays a lavender payment summary and wallet selector with an explicit no-bank-payment notice. Paid/unpaid actions persist through finance RPCs. Reversing paid status removes the linked payment and restores the recorded balance; deleting a bill preserves its payment as an ordinary persisted expense.
- Managed agenda keeps date/week navigation, completion checkbox, edit/delete actions, counts, and empty dates in the timeline. Completion strikes the title; deleted records require confirmation. Bills provide status filters and recorded paid/unpaid actions; goals share persisted contribution/progress state across Keuangan and Berdua.
- `AgendaForm` is shared by the visible calendar composer and the edit sheet, with unique generated field IDs. Creation collects title, date, time, assignee, and optional notes. The selected day and inline date stay synchronized without resetting other draft fields. Save awaits persistence before clearing the creation draft; Kosongkan clears only the draft. Tambah agenda focuses the visible title field. Notes use themed muted placeholders and a current-color caret. Production save notices identify the shared Supabase household; session-only notices belong to preview fixtures.
- `HouseForms.tsx` shares bill/document/contact fields between visible creation forms and edit sheets, with generated unique IDs. Each form has a Kosongkan draft action and a specific full-width save action. Bills retain amount/date/optional customer number and persisted payment linkage. Documents record name/type/expiry/notes, not uploaded files; remaining, today, and overdue states derive from calendar days. Contacts use name/phone/category/optional role, validate phone digits, and normalize telephone destinations. List add actions focus the inline form; edit opens populated sheets, and delete requires confirmation. Empty lists keep their forms available. House note placeholders use themed muted text and current-color carets.
- Native dialog behavior supports Escape, close control, backdrop click, and focus restoration. Inline alerts explain invalid transfers, insufficient funds, duplicate wallet names, referenced-wallet/funded-goal deletion, or dependent income deletion. Connected saves expose pending state and disable repeat submission; rejected writes retain the open form and draft. Successful writes close the editor and emit a live status notice after attempting a fresh read. A successful write followed by a failed refresh is explicitly reported as already saved, not a failed save; a refresh error blocks further writes until data reloads. The header/footer and FormEnd distinguish persisted household records from preview fixtures and retain the no-bank/money-movement limitation.

### Connection and Household Access
- `src/main.tsx` mounts `ConnectionRoot`, which restores the Auth session before loading identity and household membership. Email/password login, signup, email-confirmation guidance when required, reset-email request, and recovery-password update use Supabase Auth. Missing configuration, session/identity failures, and household-load failures show configuration or recovery states, never sample household fallback.
- Onboarding explicitly calls `initialize_profile` before `create_household` or `join_household`. Creation collects household name and member role; joining accepts the partner's invitation code. The household supports at most two members and begins without seeded records. Returning members proceed to their existing household rather than repeating setup.
- Access forms reuse the existing segmented controls, labeled fields, neutral primary action, theme-aware borders, and lavender status messages. Inputs have minimum height (50px), corners (13px), padding (13px), and (16px) text through (759px). Busy fieldsets disable inputs/actions, action labels explain progress, errors use alerts, and confirmation/recovery feedback uses status text. No new imagery or shipping raster assets were created.
- Connected records use schema `myhome`: finance mutations use transactional RPCs; household tables use RLS-protected reads/writes. The server sets transaction authorship from the authenticated session. Wallets, transactions, budgets, goals, bills, agenda, documents, contacts, chores, shopping, wishlist places, and food/date ideas persist rather than resetting on reload. Background reads follow Realtime events when enabled, window focus, manual Muat ulang, and (30-second) polling; this is not offline storage or a guarantee of managed Realtime delivery.
- Verification boundary: `.impeccable/review/connected-results.json` records (63) passing local browser checks using mocked Auth/PostgREST backed by actual SQL/RLS in PGlite; (36) domain/SQL checks were reported passing. These are local evidence, not managed-Supabase certification. The configured key returns `Invalid API key`, so managed email Auth, PostgREST/RLS, Realtime, and multi-connection behavior remain unverified pending valid configuration and a real two-account smoke test.

### Account Avatar and Profile Panel
- AccountProvider supplies current profile and household members. The header no longer presents two role buttons. ProfileAvatar renders a provided avatarUrl inside a circular clipped surface using object-fit cover; missing/failed URLs show up to two initials rather than invented photography. Header avatars are (40px) inside a minimum (44px) trigger; existing member/recorder size classes remain context-specific.
- The profile panel is nonmodal, with close, outside-click, Escape, Tab, and focus-return behavior. Its (280px) width is capped by the viewport, with (22px) corners, (19px) inset, and right edge aligned to the rightmost account control (`right: 0`). The existing theme-before-avatar header order is preserved. Height is bounded to (100dvh - 115px), with vertical scrolling for profile and invitation controls. Below (360px), width becomes (264px), inset (17px). Light surface is white, dark surface (#25262f); the two shadows in the sidecar mark this temporary elevation.
- The connected panel edits the profile name and optional HTTPS avatar URL through `initialize_profile`, with pending, error, and saved feedback. No photo upload or storage integration is supplied; missing/failed images retain initials. An owner with fewer than two household members can issue a (32-character) invitation, valid for (48 hours) and single use; generating another invalidates the previous code. Copy supports manual selection if clipboard access fails. Signout removes household access without removing membership.
- Preview-only account choices remain explicitly labeled simulation in test/development fixtures, not production login. Connected accounts hide and disable preview switching. Greeting, member avatars, and recorder identity use persisted profile data; editing an existing transaction keeps its original recorder.

## Do's and Don'ts

### Do:
- **Do** keep the reference-led white/charcoal hierarchy and quiet lavender secondary grouping.
- **Do** use the user-selected self-hosted Poppins, tabular money, household initials, and semantic inline SVG icons.
- **Do** preserve mobile stacking, bottom-dock access, safe-area padding, and visible keyboard focus.
- **Do** reuse labeled fields, formatted MoneyInput, six expense category radios, wallet/date/pocket controls, recorder identity, and full-width save in the shared transaction editor.
- **Do** retain the theme-aware text, labels, focus, selected states, and dialog treatments in both modes.
- **Do** use semantic workspace roles for added controls and keep wallet, budget, bill, and goal feedback tied to the same persisted household ledger.
- **Do** retain the pocket-money clamp and native scrollable editor/confirmation sheets at narrow widths.

### Don't:
- **Don't** replace the user-selected Poppins or introduce invented profile photography.
- **Don't** elevate every record into a shadowed card or turn every control into a pill.
- **Don't** replace inline SVG decoration with new raster assets, present test/development fixtures as real household records, or fall back to a preview when a production connection fails.
- **Don't** put expense recording back in the five-destination dock or confuse theme-preference storage with financial-data persistence.
