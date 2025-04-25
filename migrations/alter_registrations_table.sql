-- Menambahkan kolom notes ke tabel registrations
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS notes TEXT;

-- Menambahkan kolom untuk mendukung sistem pembayaran dengan kode unik
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS final_amount NUMERIC DEFAULT 0;

-- Memastikan kolom total_amount ada
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;

-- Menambahkan kolom untuk mendukung sistem pembayaran dengan kode unik di tabel payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;
