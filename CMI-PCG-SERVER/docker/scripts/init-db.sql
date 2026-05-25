-- ============================================
-- CMI-PCG-SERVER - Database Initialization
-- ============================================
--
-- This script runs automatically when the PostgreSQL
-- container is created for the first time.
--
-- It sets up:
-- 1. Extensions
-- 2. Database configurations
-- 3. Initial schema (if using raw SQL)
--

-- ===========================================
-- Extensions
-- ===========================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Full text search in Portuguese
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================
-- Database Configuration
-- ===========================================

-- Set default timezone
SET timezone = 'America/Sao_Paulo';

-- ===========================================
-- Portuguese Full Text Search Configuration
-- ===========================================

-- Create a custom Portuguese text search configuration if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_ts_config WHERE cfgname = 'portuguese_unaccent'
    ) THEN
        CREATE TEXT SEARCH CONFIGURATION portuguese_unaccent (COPY = portuguese);
        ALTER TEXT SEARCH CONFIGURATION portuguese_unaccent
            ALTER MAPPING FOR hword, hword_part, word
            WITH unaccent, portuguese_stem;
    END IF;
END $$;

-- ===========================================
-- Helpful Functions
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to normalize CPF (remove formatting)
CREATE OR REPLACE FUNCTION normalize_cpf(cpf_text TEXT)
RETURNS BIGINT AS $$
BEGIN
    RETURN CAST(REGEXP_REPLACE(cpf_text, '[^0-9]', '', 'g') AS BIGINT);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to format CPF for display
CREATE OR REPLACE FUNCTION format_cpf(cpf_number BIGINT)
RETURNS TEXT AS $$
DECLARE
    cpf_str TEXT;
BEGIN
    cpf_str := LPAD(cpf_number::TEXT, 11, '0');
    RETURN SUBSTRING(cpf_str, 1, 3) || '.' ||
           SUBSTRING(cpf_str, 4, 3) || '.' ||
           SUBSTRING(cpf_str, 7, 3) || '-' ||
           SUBSTRING(cpf_str, 10, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to normalize CNPJ (remove formatting)
CREATE OR REPLACE FUNCTION normalize_cnpj(cnpj_text TEXT)
RETURNS BIGINT AS $$
BEGIN
    RETURN CAST(REGEXP_REPLACE(cnpj_text, '[^0-9]', '', 'g') AS BIGINT);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to format CNPJ for display
CREATE OR REPLACE FUNCTION format_cnpj(cnpj_number BIGINT)
RETURNS TEXT AS $$
DECLARE
    cnpj_str TEXT;
BEGIN
    cnpj_str := LPAD(cnpj_number::TEXT, 14, '0');
    RETURN SUBSTRING(cnpj_str, 1, 2) || '.' ||
           SUBSTRING(cnpj_str, 3, 3) || '.' ||
           SUBSTRING(cnpj_str, 6, 3) || '/' ||
           SUBSTRING(cnpj_str, 9, 4) || '-' ||
           SUBSTRING(cnpj_str, 13, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ===========================================
-- Indexes (will be created by Alembic)
-- ===========================================

-- Note: Most indexes are created by Flask-Migrate/Alembic
-- Only add indexes here for special cases

-- ===========================================
-- Grants
-- ===========================================

-- Grant all privileges on all tables to the application user
-- (This runs as the same user, so not strictly necessary)

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed at %', NOW();
END $$;
