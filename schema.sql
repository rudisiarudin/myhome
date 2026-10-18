-- ==============================================================================
-- SCHEMA SISTEM "MYHOME" (SUPABASE POSTGRESQL + DEDICATED HOUSEHOLD_MEMBERS)
-- Versi: Bebas Konflik dengan Tabel `profiles` Bawaan Supabase
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABEL RUMAH TANGGA & ANGGOTA (MENGGUNAKAN TABEL KHUSUS SENDIRI)
-- ==============================================================================

-- Tabel Keluarga / Rumah Tangga
CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL DEFAULT 'Keluarga Bahagia',
    invite_code VARCHAR(12) UNIQUE NOT NULL DEFAULT substring(md5(random()::text), 1, 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Tabel Anggota Keluarga (DEDICATED: Tidak menyentuh / tidak bergantung pada public.profiles lama!)
CREATE TABLE IF NOT EXISTS public.household_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL DEFAULT '',
    role VARCHAR(20) NOT NULL DEFAULT 'suami' CHECK (role IN ('suami', 'istri', 'anggota')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(user_id, household_id)
);

-- Pengaturan Anggaran Keluarga
CREATE TABLE IF NOT EXISTS public.household_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL UNIQUE REFERENCES public.households(id) ON DELETE CASCADE,
    daily_budget BIGINT NOT NULL DEFAULT 250000,
    monthly_budget BIGINT NOT NULL DEFAULT 7500000,
    suami_pocket_budget BIGINT NOT NULL DEFAULT 1000000,
    istri_pocket_budget BIGINT NOT NULL DEFAULT 1000000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ==============================================================================
-- 3. KEUANGAN & PEMBUKUAN (WALLETS, TRANSACTIONS, GOALS, BILLS)
-- ==============================================================================

-- Dompet / Sumber Dana (BCA, Kas Tunai, GoPay, dll)
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('cash', 'bank', 'ewallet')),
    owner VARCHAR(20) NOT NULL CHECK (owner IN ('berdua', 'suami', 'istri')),
    opening_balance BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Target Tabungan / Wishlist Impian Bersama
CREATE TABLE IF NOT EXISTS public.saving_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    target_amount BIGINT NOT NULL,
    opening_amount BIGINT NOT NULL DEFAULT 0,
    target_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Tagihan Rutin Rumah Tangga
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    amount BIGINT NOT NULL,
    due_date DATE NOT NULL,
    customer_number VARCHAR(60) DEFAULT '',
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_by VARCHAR(20) CHECK (paid_by IN ('suami', 'istri')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Transaksi Kas Masuk, Keluar, Transfer, & Tabungan
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
    to_wallet_id UUID REFERENCES public.wallets(id) ON DELETE RESTRICT,
    goal_id UUID REFERENCES public.saving_goals(id) ON DELETE SET NULL,
    bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('expense', 'income', 'transfer', 'saving')),
    title VARCHAR(150) NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    category VARCHAR(30) NOT NULL,
    pocket VARCHAR(20) NOT NULL DEFAULT 'household' CHECK (pocket IN ('household', 'suami', 'istri')),
    recorded_by VARCHAR(20) NOT NULL CHECK (recorded_by IN ('suami', 'istri')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ==============================================================================
-- 4. AGENDA & KALENDER BERSAMA
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    date DATE NOT NULL,
    time VARCHAR(10) NOT NULL,
    assignee VARCHAR(20) NOT NULL CHECK (assignee IN ('suami', 'istri', 'berdua')),
    note TEXT DEFAULT '',
    is_done BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ==============================================================================
-- 5. KOPER DIGITAL RUMAH (DOKUMEN & KONTAK DARURAT)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('kendaraan', 'lisensi', 'garansi', 'rumah', 'lainnya')),
    expiry_date DATE NOT NULL,
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100) DEFAULT '',
    phone VARCHAR(30) NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('keamanan', 'servis', 'medis', 'rt', 'lainnya')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ==============================================================================
-- 6. RUANG BERDUA (SHOPPING, CHORES, WISHLIST PLACES, FOOD DECISIONS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.shopping_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    is_bought BOOLEAN NOT NULL DEFAULT FALSE,
    added_by VARCHAR(20) NOT NULL CHECK (added_by IN ('suami', 'istri')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.chores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    assignee VARCHAR(20) NOT NULL CHECK (assignee IN ('suami', 'istri', 'berdua')),
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('harian', 'mingguan')),
    is_done BOOLEAN NOT NULL DEFAULT FALSE,
    last_done_by VARCHAR(20) CHECK (last_done_by IN ('suami', 'istri')),
    last_done_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.wishlist_places (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    location VARCHAR(120) DEFAULT '',
    category VARCHAR(20) NOT NULL CHECK (category IN ('kopi', 'makan', 'jalan', 'liburan')),
    est_budget BIGINT,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.food_ideas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('masak', 'makan-luar')),
    tag VARCHAR(50) DEFAULT 'Favorit',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saving_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_ideas ENABLE ROW LEVEL SECURITY;

-- Helper Function: Dapatkan household_id user dari tabel household_members
CREATE OR REPLACE FUNCTION public.current_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM public.household_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Kebijakan Anggota Keluarga
DROP POLICY IF EXISTS "Akses Anggota: household_members" ON public.household_members;
CREATE POLICY "Akses Anggota: household_members" ON public.household_members
    FOR ALL USING (user_id = auth.uid() OR household_id = public.current_household_id());

-- Kebijakan Data Rumah Tangga
DROP POLICY IF EXISTS "Akses Keluarga: households" ON public.households;
CREATE POLICY "Akses Keluarga: households" ON public.households
    FOR ALL USING (id = public.current_household_id());

DROP POLICY IF EXISTS "Akses Keluarga: household_budgets" ON public.household_budgets;
CREATE POLICY "Akses Keluarga: household_budgets" ON public.household_budgets
    FOR ALL USING (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Akses Keluarga: wallets" ON public.wallets;
CREATE POLICY "Akses Keluarga: wallets" ON public.wallets
    FOR ALL USING (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Akses Keluarga: saving_goals" ON public.saving_goals;
CREATE POLICY "Akses Keluarga: saving_goals" ON public.saving_goals
    FOR ALL USING (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Akses Keluarga: bills" ON public.bills;
CREATE POLICY "Akses Keluarga: bills" ON public.bills
    FOR ALL USING (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Akses Keluarga: transactions" ON public.transactions;
CREATE POLICY "Akses Keluarga: transactions" ON public.transactions
    FOR ALL USING (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Akses Keluarga: events" ON public.events;
CREATE POLICY "Akses Keluarga: events" ON public.events
    FOR ALL USING (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Akses Keluarga: documents" ON public.documents;
CREATE POLICY "Akses Keluarga: documents" ON public.documents
    FOR ALL USING (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Akses Keluarga: contacts" ON public.contacts;
CREATE POLICY "Akses Keluarga: contacts" ON public.contacts
    FOR ALL USING (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Akses Keluarga: shopping_items" ON public.shopping_items;
CREATE POLICY "Akses Keluarga: shopping_items" ON public.shopping_items
    FOR ALL USING (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Akses Keluarga: chores" ON public.chores;
CREATE POLICY "Akses Keluarga: chores" ON public.chores
    FOR ALL USING (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Akses Keluarga: wishlist_places" ON public.wishlist_places;
CREATE POLICY "Akses Keluarga: wishlist_places" ON public.wishlist_places
    FOR ALL USING (household_id = public.current_household_id());

DROP POLICY IF EXISTS "Akses Keluarga: food_ideas" ON public.food_ideas;
CREATE POLICY "Akses Keluarga: food_ideas" ON public.food_ideas
    FOR ALL USING (household_id = public.current_household_id());

-- ==============================================================================
-- 8. REALTIME REPLICATION
-- ==============================================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE 
      public.transactions,
      public.shopping_items,
      public.chores,
      public.bills,
      public.events;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
