import { EXEMPT_PACKAGES, CSS_WIDE_KEYWORDS } from './constants.js';

/**
 * Convert a CSS size value to rem.
 */
export function convertToRem(size: string): number {
    size = size.trim().toLowerCase();

    if (size.endsWith('px')) {
        return parseFloat(size) / 16;
    }

    if (size.endsWith('em') || size.endsWith('rem')) {
        return parseFloat(size);
    }

    return 0;
}

/**
 * Determine if a package is exempt from externalization.
 */
export function isExemptPackage(id: string): boolean {
    return (EXEMPT_PACKAGES as readonly string[]).includes(id);
}

/**
 * Determine if a value is a CSS-wide keyword.
 */
export function isCssWideKeyword(value: string): boolean {
    return (CSS_WIDE_KEYWORDS as readonly string[]).includes(value);
}
