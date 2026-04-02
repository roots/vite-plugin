import type { FontFamily } from '../types.js';
import { INVALID_FONT_PROPS } from '../constants.js';

/**
 * Process Tailwind font families into theme.json format.
 */
export function processFontFamilies(
    fonts: Record<string, string[] | string>,
    fontLabels?: Record<string, string>
): FontFamily[] {
    return Object.entries(fonts).map(([name, value]) => {
        const fontFamily = Array.isArray(value) ? value.join(', ') : value;
        const displayName = fontLabels?.[name] ?? name;

        return {
            name: displayName,
            slug: name.toLowerCase(),
            fontFamily,
        };
    });
}

/**
 * Resolve font families from @theme variables and Tailwind config.
 */
export function resolveFonts(
    variables: Array<[string, string]>,
    tailwindFonts: Record<string, string[] | string> | undefined,
    fontLabels?: Record<string, string>
): FontFamily[] {
    const entries: FontFamily[] = [];

    for (const [name, value] of variables) {
        if (INVALID_FONT_PROPS.some((prop) => name.includes(prop))) continue;

        const displayName = fontLabels?.[name] ?? name;

        entries.push({
            name: displayName,
            slug: name.toLowerCase(),
            fontFamily: value.replace(/['"]/g, ''),
        });
    }

    if (tailwindFonts) {
        entries.push(...processFontFamilies(tailwindFonts, fontLabels));
    }

    return entries;
}
