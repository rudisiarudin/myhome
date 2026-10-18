# MyHome

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users and Purpose
A shared household application for Rudi and his partner. Keep the existing daily budget, expenses, shared agenda, household information, shopping, goals, and decision tools.

## Capabilities and Constraints
The user subsequently approved connecting the frontend to the supplied Supabase SQL and pushing the project to their GitHub repository. The production entrypoint now requires email Auth and a household membership, uses schema `myhome` with RLS and financial RPCs, and loads real empty households rather than seeding demo records. Existing preview providers remain test/development fixtures only. Profile editing accepts an optional HTTPS avatar URL; upload/storage and real banking remain outside scope. Realtime events (when enabled), focus refresh, explicit refresh, and 30-second polling update shared records. Live-project smoke testing depends on valid user-provided URL/key configuration. Statements below describe earlier preview milestones, not the current persistence behavior.

The user approved a visual update across all five existing tabs while preserving functionality and existing sample data. React, TypeScript, and Vite are already in use. Current application state is in memory; this work does not introduce a backend or persistence.

The user subsequently approved interactive frontend previews of all proposed household capabilities, explicitly deferring the database. Included: wallet creation/editing/deletion with opening balances; income, expenses, transfers, and transaction history/edit/delete/filtering; configurable household and pocket budgets; agenda creation/edit/delete/completion; bill creation/edit/delete and simulated paid/unpaid recording; savings goals and wallet-funded contributions. Wallet balances and goal progress derive from one in-memory ledger. Linked bill payments are reflected in both the ledger and bill state. Transfers and savings are not household consumption. Guardrails prevent invalid transfers, insufficient funds, and deleting referenced wallets/goals. No bank/payment integration, authentication, cross-device synchronization, or permanent household storage is implied.

The user requested directly visible forms in Kalender Berdua and Urusan Rumah. Each Rumah sub-section now has its own inline entry form: Tagihan, Dokumen, and Kontak. Documents and contacts support create/edit/delete in the same temporary household state. Document records track category, expiry, and notes, with remaining days derived from the date; this is not file upload or storage. Contacts track name, category, phone, and optional role; phone destinations use validated normalized numbers. Existing sample contacts are not presented as genuine emergency services. Clear resets drafts, not saved records; deletion uses confirmation.

The user requested account-driven profile avatars instead of the Rudi/Istri header switch. AccountProvider accepts a supplied UserProfile and household members; header, greeting, household avatars, and transaction-recorder identity consume this data. Avatar URL is optional; absent or failed images fall back to initials. Without an account supplied, explicitly labeled sample-account preview remains available inside the avatar panel. Supplied accounts do not expose or accept preview account switching. This is frontend profile binding, not implemented authentication, photo upload, or database integration. New transactions and simulated bill payments retain the supplied profile ID alongside their existing household role; editing preserves the original recorder.

## Brand Commitments
The supplied mobile reference is the visual authority: white and charcoal, rounded cards, generous typography, a timeline, and bottom navigation. Keep MyHome and the existing household identity. Use initials rather than inventing profile photographs. The user subsequently requested light/dark switching and explicitly moved expense recording out of the bottom navigation. Expense entry lives in the daily allowance summary and the budget page. Theme preference is browser-persisted; household records remain session-only.

Poppins is the user-selected typeface across the application, self-hosted as Latin WOFF2 in four used weights (400, 500, 600, 700).

## Evidence on Hand
Existing data in the application is sample data, confirmed by the user. Label it accordingly. The user-supplied image is a style reference, not a source of product features or factual claims.
