-- Populate slugs for existing posts
-- This migration is safe to run multiple times (only updates NULL slugs)
-- Replaces dots with hyphens (5.5 → 5-5) like GitHub/Notion

UPDATE posts SET slug =
  LOWER(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(title, '.', '-'),
                  ' ', '-'
                ),
                ',', ''
              ),
              ':', ''
            ),
            '?', ''
          ),
          '!', ''
        ),
        '--', '-'
      ),
      '--', '-'
    )
  )
WHERE slug IS NULL;
