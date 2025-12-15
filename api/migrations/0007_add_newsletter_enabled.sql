-- Migration: Add newsletter enabled column
-- Date: 2025-12-14
-- Description: Adds newsletter_enabled column to users table for newsletter subscription preference

ALTER TABLE users ADD COLUMN newsletter_enabled INTEGER DEFAULT 1 NOT NULL;
