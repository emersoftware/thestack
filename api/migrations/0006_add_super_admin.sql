-- Migration: Add super admin column
-- Date: 2025-12-11
-- Description: Adds is_super_admin column to users table for elevated admin privileges

ALTER TABLE users ADD COLUMN is_super_admin INTEGER DEFAULT 0;
