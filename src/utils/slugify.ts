/**
 * slugify - Convert text to URL-friendly slug
 *
 * Converts role names, titles, or any text to lowercase,
 * hyphen-separated slugs suitable for filenames and URLs.
 */

/**
 * Convert text to slug format
 * - Convert to lowercase
 * - Replace spaces and special characters with hyphens
 * - Remove consecutive hyphens
 * - Trim leading/trailing hyphens
 *
 * @param text - Input text to convert
 * @param maxLength - Maximum length (default: 50)
 * @returns URL-friendly slug
 */
export function slugify(text: string, maxLength: number = 50): string {
  if (!text || text.trim() === '') {
    return '';
  }

  return text
    .toLowerCase()
    // Replace Korean characters are kept as-is
    .normalize('NFC')
    // Replace spaces and special chars with hyphens
    .replace(/[\s\u2000-\u200B\u3000_]+/g, '-')
    // Remove characters that aren't alphanumeric, Korean, or hyphen
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    // Replace multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Trim hyphens from start/end
    .replace(/^-+|-+$/g, '')
    // Limit length
    .slice(0, maxLength);
}

/**
 * Generate a unique slug by appending a numeric suffix if needed
 *
 * @param baseSlug - Base slug to use
 * @param existingSlugs - Set of already used slugs
 * @returns Unique slug
 */
export function generateUniqueSlug(baseSlug: string, existingSlugs: Set<string>): string {
  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Validate slug format
 *
 * @param slug - Slug to validate
 * @returns True if valid
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length > 0 && slug.length <= 50;
}

/**
 * Sanitize filename (more permissive than slugify)
 *
 * @param filename - Original filename
 * @returns Safe filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/^\.+/, '') // Remove leading dots
    .slice(0, 255); // Limit length
}
