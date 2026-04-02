import type { FontSize } from '../types.js';
import { INVALID_TEXT_PROPS } from '../constants.js';
import { convertToRem } from '../utils.js';

/**
 * Process Tailwind font sizes into theme.json format.
 */
export function processFontSizes(
    sizes: Record<string, string | [string, Record<string, string>]>,
    fontSizeLabels?: Record<string, string>
): FontSize[] {
    return Object.entries(sizes).map(([name, value]) => {
        const size = Array.isArray(value) ? value[0] : value;
        const displayName = fontSizeLabels?.[name] ?? name;

        return {
            name: displayName,
            slug: name.toLowerCase(),
            size,
        };
    });
}

/**
 * Sort font sizes from smallest to largest.
 */
export function sortFontSizes(fontSizes: FontSize[]): FontSize[] {
    return [...fontSizes].sort((a, b) => {
        return convertToRem(a.size) - convertToRem(b.size);
    });
}

/**
 * Resolve font sizes from @theme variables and Tailwind config.
 */
export function resolveFontSizes(
    variables: Array<[string, string]>,
    tailwindSizes:
        | Record<string, string | [string, Record<string, string>]>
        | undefined,
    fontSizeLabels?: Record<string, string>
): FontSize[] {
    const entries: FontSize[] = [];

    for (const [name, value] of variables) {
        if (INVALID_TEXT_PROPS.some((prop) => name.includes(prop))) continue;

        const displayName = fontSizeLabels?.[name] ?? name;

        entries.push({
            name: displayName,
            slug: name.toLowerCase(),
            size: value,
        });
    }

    if (tailwindSizes) {
        entries.push(...processFontSizes(tailwindSizes, fontSizeLabels));
    }

    return entries;
}
