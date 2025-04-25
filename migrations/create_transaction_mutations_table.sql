-- Create transaction_mutations table to store bank mutations from Moota
CREATE TABLE IF NOT EXISTS transaction_mutations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  moota_mutation_id VARCHAR(100) UNIQUE NOT NULL,
  bank_id VARCHAR(100),
  account_number VARCHAR(50),
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  type VARCHAR(10) NOT NULL, -- CR (credit) or DB (debit)
  transaction_date TIMESTAMP WITH TIME ZONE,
  raw_data JSONB,
  registration_id UUID REFERENCES registrations(id),
  payment_id UUID REFERENCES payments(id),
  status VARCHAR(20) DEFAULT 'unprocessed', -- unprocessed, matched, processed, failed
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_transaction_mutations_moota_mutation_id ON transaction_mutations(moota_mutation_id);
CREATE INDEX IF NOT EXISTS idx_transaction_mutations_amount ON transaction_mutations(amount);
CREATE INDEX IF NOT EXISTS idx_transaction_mutations_transaction_date ON transaction_mutations(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transaction_mutations_status ON transaction_mutations(status);
CREATE INDEX IF NOT EXISTS idx_transaction_mutations_registration_id ON transaction_mutations(registration_id);
CREATE INDEX IF NOT EXISTS idx_transaction_mutations_payment_id ON transaction_mutations(payment_id);

-- Create function to match transaction with registration
CREATE OR REPLACE FUNCTION match_transaction_with_registration(p_transaction_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_transaction transaction_mutations;
  v_registration registrations;
  v_payment payments;
  v_result JSONB;
  v_matched BOOLEAN := FALSE;
  v_needs_review BOOLEAN := FALSE;
BEGIN
  -- Get transaction details
  SELECT * INTO v_transaction FROM transaction_mutations WHERE id = p_transaction_id;
  
  IF v_transaction IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Transaction not found'
    );
  END IF;
  
  -- If transaction is already matched, return early
  IF v_transaction.status IN ('matched', 'processed') THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Transaction already matched',
      'registration_id', v_transaction.registration_id,
      'payment_id', v_transaction.payment_id
    );
  END IF;
  
  -- Try to match by exact amount first
  SELECT r.* INTO v_registration
  FROM registrations r
  JOIN payments p ON p.registration_id = r.id
  WHERE 
    p.amount = v_transaction.amount
    AND p.status = 'pending'
    AND r.status = 'pending'
  ORDER BY r.created_at DESC
  LIMIT 1;
  
  -- If found by exact amount, this is a strong match
  IF v_registration IS NOT NULL THEN
    SELECT * INTO v_payment 
    FROM payments 
    WHERE registration_id = v_registration.id 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    v_matched := TRUE;
    v_needs_review := FALSE;
  ELSE
    -- Try to match by description containing registration number
    SELECT r.* INTO v_registration
    FROM registrations r
    WHERE 
      r.registration_number IS NOT NULL
      AND v_transaction.description ILIKE '%' || r.registration_number || '%'
      AND r.status = 'pending'
    ORDER BY r.created_at DESC
    LIMIT 1;
    
    IF v_registration IS NOT NULL THEN
      SELECT * INTO v_payment 
      FROM payments 
      WHERE registration_id = v_registration.id 
      ORDER BY created_at DESC 
      LIMIT 1;
      
      v_matched := TRUE;
      
      -- If amount differs significantly, flag for review
      IF ABS(v_payment.amount - v_transaction.amount) > 10000 THEN
        v_needs_review := TRUE;
      ELSE
        v_needs_review := FALSE;
      END IF;
    END IF;
  END IF;
  
  -- If matched, update transaction and payment
  IF v_matched THEN
    -- Update transaction
    UPDATE transaction_mutations
    SET 
      registration_id = v_registration.id,
      payment_id = v_payment.id,
      status = CASE WHEN v_needs_review THEN 'matched' ELSE 'processed' END,
      notes = CASE WHEN v_needs_review THEN 'Matched but needs review due to amount difference' ELSE 'Automatically matched' END,
      updated_at = NOW()
    WHERE id = p_transaction_id;
    
    -- If no review needed, update payment and registration status
    IF NOT v_needs_review THEN
      -- Update payment
      UPDATE payments
      SET 
        status = 'verified',
        verified_at = NOW(),
        verified_by = 'system',
        notes = COALESCE(notes, '') || ' | Automatically verified by system'
      WHERE id = v_payment.id;
      
      -- Update registration
      UPDATE registrations
      SET 
        status = 'paid',
        payment_status = TRUE,
        payment_verified_at = NOW()
      WHERE id = v_registration.id;
    END IF;
    
    v_result := jsonb_build_object(
      'success', TRUE,
      'message', 'Transaction matched with registration',
      'registration_id', v_registration.id,
      'payment_id', v_payment.id,
      'needs_review', v_needs_review
    );
  ELSE
    v_result := jsonb_build_object(
      'success', FALSE,
      'message', 'No matching registration found'
    );
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
