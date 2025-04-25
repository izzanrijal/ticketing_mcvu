-- Fungsi untuk membuat fungsi RPC get_registration_by_id
CREATE OR REPLACE FUNCTION create_get_registration_function()
RETURNS void AS $$
BEGIN
    -- Buat fungsi RPC untuk mendapatkan registrasi berdasarkan ID
    CREATE OR REPLACE FUNCTION get_registration_by_id(reg_id UUID)
    RETURNS SETOF registrations AS $$
    BEGIN
        RETURN QUERY SELECT * FROM registrations WHERE id = reg_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
END;
$$ LANGUAGE plpgsql;

-- Buat fungsi RPC untuk mendapatkan registrasi berdasarkan ID
CREATE OR REPLACE FUNCTION get_registration_by_id(reg_id UUID)
RETURNS SETOF registrations AS $$
BEGIN
    RETURN QUERY SELECT * FROM registrations WHERE id = reg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
