/**
 * Sanitization utilities for user inputs
 * Defense in depth - Svelte already escapes HTML, but we strip tags in backend too
 */

/**
 * Strip HTML tags from input string
 * Removes anything between < and > including the brackets
 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize user input: strip HTML tags and trim whitespace
 */
export function sanitizeInput(input: string): string {
  return stripHtmlTags(input).trim();
}
