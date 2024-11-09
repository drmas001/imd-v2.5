-- Drop existing shift_type enum and recreate with weekend shifts
DROP TYPE IF EXISTS shift_type CASCADE;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_type') THEN
        CREATE TYPE shift_type AS ENUM (
            'morning',    -- Regular weekday morning shift
            'evening',    -- Regular weekday evening shift
            'night',      -- Regular weekday night shift
            'weekend_morning',  -- Weekend morning shift (7:00 - 19:00)
            'weekend_night'     -- Weekend night shift (19:00 - 7:00)
        );
    END IF;
END $$;

-- First, add the column without NOT NULL constraint
ALTER TABLE admissions
DROP COLUMN IF EXISTS shift_type;

ALTER TABLE admissions
ADD COLUMN shift_type shift_type;

-- Update existing records to have a default value
UPDATE admissions
SET shift_type = 'morning'
WHERE shift_type IS NULL;

-- Now add the NOT NULL constraint
ALTER TABLE admissions
ALTER COLUMN shift_type SET NOT NULL;

-- Add is_weekend column to help with shift management
ALTER TABLE admissions
ADD COLUMN IF NOT EXISTS is_weekend BOOLEAN DEFAULT false;

-- Add safety_type enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'safety_type') THEN
        CREATE TYPE safety_type AS ENUM ('emergency', 'observation', 'short-stay');
    END IF;
END $$;

-- Add safety_type column to admissions table if it doesn't exist
ALTER TABLE admissions
ADD COLUMN IF NOT EXISTS safety_type safety_type;

-- Add visit_number column to admissions table if it doesn't exist
ALTER TABLE admissions
ADD COLUMN IF NOT EXISTS visit_number INTEGER NOT NULL DEFAULT 1;

-- Create index for safety type
CREATE INDEX IF NOT EXISTS idx_admissions_safety_type 
ON admissions(safety_type) 
WHERE safety_type IS NOT NULL;

-- Create index for visit number
CREATE INDEX IF NOT EXISTS idx_admissions_visit_number 
ON admissions(patient_id, visit_number);

-- Create index for shift type
CREATE INDEX IF NOT EXISTS idx_admissions_shift_type 
ON admissions(shift_type);

-- Create index for weekend flag
CREATE INDEX IF NOT EXISTS idx_admissions_is_weekend 
ON admissions(is_weekend);

-- Remove unique constraint on patients.mrn if it exists
ALTER TABLE patients
DROP CONSTRAINT IF EXISTS patients_mrn_key;

-- Add non-unique index on mrn for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_mrn 
ON patients(mrn);

-- Update view to include safety type, shift type, weekend flag and visit number
DROP VIEW IF EXISTS active_admissions;
CREATE VIEW active_admissions AS
SELECT 
    a.id,
    a.patient_id,
    p.mrn,
    p.name,
    a.admission_date,
    a.department,
    a.safety_type::text as safety_type,
    a.shift_type::text as shift_type,
    a.is_weekend,
    u.name as doctor_name,
    a.diagnosis,
    a.status,
    a.visit_number
FROM 
    admissions a
    JOIN patients p ON a.patient_id = p.id
    LEFT JOIN users u ON a.admitting_doctor_id = u.id
WHERE 
    a.status = 'active';

-- Create function to automatically set is_weekend based on admission_date
CREATE OR REPLACE FUNCTION set_is_weekend()
RETURNS TRIGGER AS $$
BEGIN
    -- Extract day of week (1-7, where 1 is Sunday)
    NEW.is_weekend := EXTRACT(DOW FROM NEW.admission_date) IN (5, 6);  -- Friday and Saturday
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set is_weekend
DROP TRIGGER IF EXISTS set_admission_is_weekend ON admissions;
CREATE TRIGGER set_admission_is_weekend
    BEFORE INSERT OR UPDATE OF admission_date
    ON admissions
    FOR EACH ROW
    EXECUTE FUNCTION set_is_weekend();

-- Create function to validate shift type based on is_weekend
CREATE OR REPLACE FUNCTION validate_shift_type()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_weekend AND NEW.shift_type NOT IN ('weekend_morning', 'weekend_night') THEN
        RAISE EXCEPTION 'Weekend admissions must use weekend shift types';
    END IF;
    IF NOT NEW.is_weekend AND NEW.shift_type IN ('weekend_morning', 'weekend_night') THEN
        RAISE EXCEPTION 'Weekday admissions cannot use weekend shift types';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate shift type
DROP TRIGGER IF EXISTS validate_admission_shift_type ON admissions;
CREATE TRIGGER validate_admission_shift_type
    BEFORE INSERT OR UPDATE OF shift_type, is_weekend
    ON admissions
    FOR EACH ROW
    EXECUTE FUNCTION validate_shift_type();