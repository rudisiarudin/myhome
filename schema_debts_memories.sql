-- ==============================================================================
-- ADD-ON TABLE: CICILAN / KPR & MEMORIES JURNAL BERDUA
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('kpr', 'kendaraan', 'personal', 'piutang')),
    lender_or_borrower VARCHAR(120) NOT NULL,
    total_amount BIGINT NOT NULL CHECK (total_amount > 0),
    remaining_amount BIGINT NOT NULL CHECK (remaining_amount >= 0),
    monthly_payment BIGINT,
    due_day INT,
    tenor_months INT,
    remaining_months INT,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('kencan', 'milestone', 'liburan', 'rumah')),
    recorded_by VARCHAR(20) NOT NULL CHECK (recorded_by IN ('suami', 'istri')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Akses Keluarga: debts" ON public.debts FOR ALL USING (household_id = public.current_household_id());
CREATE POLICY "Akses Keluarga: memories" ON public.memories FOR ALL USING (household_id = public.current_household_id());
