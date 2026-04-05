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
export declare function slugify(text: string, maxLength?: number): string;
/**
 * Generate a unique slug by appending a numeric suffix if needed
 *
 * @param baseSlug - Base slug to use
 * @param existingSlugs - Set of already used slugs
 * @returns Unique slug
 */
export declare function generateUniqueSlug(baseSlug: string, existingSlugs: Set<string>): string;
/**
 * Validate slug format
 *
 * @param slug - Slug to validate
 * @returns True if valid
 */
export declare function isValidSlug(slug: string): boolean;
/**
 * Sanitize filename (more permissive than slugify)
 *
 * @param filename - Original filename
 * @returns Safe filename
 */
export declare function sanitizeFilename(filename: string): string;
//# sourceMappingURL=slugify.d.ts.map