-- ==============================================================================
-- STEP 1: DETEKSI & BERSIHKAN POLICY / FUNCTION LAMA YANG MEMICU ERROR
-- Jalankan blok ini terlebih dahulu untuk menghapus jejak policy yang nyangkut.
-- ==============================================================================

DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Hapus semua policy yang menempel pada tabel profiles jika ada
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

-- Hapus function lama yang merujuk ke kolom yang hilang
DROP FUNCTION IF EXISTS public.current_household_id() CASCADE;
