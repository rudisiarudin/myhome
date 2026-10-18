# MyHome application

Mode: Operate. Scope: all five tabs in src/App.tsx, with the existing workflows and sample records preserved.

Current extension: user requested all proposed wallet/transaction/budget/agenda/bill/goal features as an interactive UI preview, explicitly deferring the database. Preserve the existing Poppins, light/dark themes, white/charcoal/lavender language, and five-item navigation. Financial work lives in Keuangan with Ringkasan, Dompet, and Riwayat sub-sections. Existing entry sheets extend into consistent labeled forms with explicit simulation notices. Destructive actions use confirmation sheets. Calendar and bills keep their existing destinations; goals remain shared between Keuangan and Ruang Berdua.

## Direction contract
THESIS: A calm shared household organizer, using the user's monochrome reference instead of the incumbent industrial terminal styling.

OWN-WORLD: White canvas, charcoal feature cards, pale lavender secondary surfaces, generous rounded corners, readable sans-serif typography. Fine wave lines belong only to the dark greeting and featured agenda entry, reflecting the supplied reference. They are non-interactive and decorative.

STORY: See today's spending, jump to shared decisions or shopping, follow the agenda, and record an expense without losing the current context.

FIRST VIEWPORT: A charcoal greeting with household initials, a daily allowance summary with its own Catat action, two contrasting shared-space shortcuts, and a shopping checklist. Desktop expands to two work columns; mobile keeps one column. The fixed bottom dock contains only the five destinations. Expense entry also remains available from Keuangan. Calendar uses a selected-day strip and connected timeline. A sun/moon button next to the role switch changes the entire application theme.

FORM: User-pinned image reference, no concept seed required. ENERGY 2 / RHYTHM 2 / MOTION 1. The reference defines light mode; the user's explicit follow-up adds a matching dark mode. Motion is limited to feedback and the existing randomizer.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisions and reasons
- White and charcoal reproduce the user's reference and separate primary actions from everyday records.
- Lavender quietly differentiates the shopping shortcut without introducing a competing accent palette.
- Poppins is explicitly requested by the user for all application typography. The four used weights are self-hosted so font loading stays on the application's origin, including LAN access.
- Large rounded feature cards reproduce the requested visual language; compact list rows remain unboxed where possible.
- Semantic library icons identify actual actions; initial-based avatars avoid invented identities.
- Data remains local and synchronous. Empty lists, randomizer loading, clipboard failure, form validation, and live feedback are handled without fake network loading.
- The follow-up request specifically refines expense entry: large formatted rupiah field first, description second, six icon-and-label category radios, recorder identity, and one full-width save action. Radio tiles preserve the existing categories and keyboard semantics.
- Chevrons signal navigation to another tab; transaction arrows signal money leaving the household. Save uses a checkmark rather than a navigation arrow.
- The modal's shadow separates protected form input from the background; list rows have no individual elevation. Thin wave lines are a deliberate reference motif, not a page-wide texture.
- Both themes use the same layout and typography. Dark mode separates the near-black canvas, charcoal panels, and lavender-tinted secondary surfaces; selected controls invert to a light fill for clear state contrast.
- The theme follows the OS on first use and remembers a manual choice in localStorage. The five-item dock contains navigation only, per the user's follow-up; Catat lives beside the household allowance instead of in the dock.
- Wallet panels group balances and ownership; flat transaction rows keep history scannable. Three explicit finance actions separate incoming, outgoing, and internal transfers without adding another navigation destination.
- Section-specific actions make add/edit/pay/contribute discoverable. Confirmation sheets protect ledger consistency; inline errors explain why referenced wallets, funded goals, or dependent income cannot be deleted.
- Budget/pocket values and savings progress derive from the same ledger as wallets. Existing tab shells inherit the visual world; new forms use the same Poppins, rounded control shapes, focus treatments, and light/dark semantic tokens.
- Success means all frontend flows are demonstrable with temporary sample data and no implied external payment or database connection. The date strip now follows the actual local calendar and supports week/date navigation.
- Calendar follow-up: display a permanent labeled agenda form directly on Kalender Berdua. The form precedes the timeline on mobile and sits alongside it on desktop; it reuses the edit-sheet fields. Selected dates synchronize without discarding draft text, saving updates the visible day, and clearing does not delete saved events.
- Rumah follow-up: show a permanent entry form in each of Tagihan, Dokumen, and Kontak. Inline creation and modal editing share fields with unique IDs. Keep payment/rollback behavior; add temporary document/contact CRUD, category selectors, actual date-derived expiry feedback, phone validation, and explicit no-file-upload / sample-contact notices. Form precedes list on mobile and sits beside it on desktop. Add shortcuts focus the existing form rather than opening another creation sheet.
- Account follow-up: replace the visible Rudi/Istri header segments with the active account's circular avatar and a profile panel beside the unchanged theme control. Use supplied profile name/photo, initial fallback for missing/failed images, and the same member data for household avatars and recorder identity. A clearly labeled sample-account chooser exists only in preview mode; externally supplied account data disables that chooser. Authentication/photo upload remain deferred. Preserve the separately added chores, places, and current visual refinements rather than reverting them.
