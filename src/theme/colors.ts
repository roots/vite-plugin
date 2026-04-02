import type { ColorPalette } from '../types.js';

/**
 * Flatten a nested color object into [name, value] pairs.
 */
export function flattenColors(
    colors: Record<string, unknown>
): Array<[string, string]> {
    const flattened: Array<[string, string]> = [];

    for (const [name, value] of Object.entries(colors)) {
        if (typeof value === 'string') {
            flattened.push([name, value]);
        } else if (typeof value === 'object' && value !== null) {
            for (const [shade, shadeValue] of Object.entries(value)) {
                if (typeof shadeValue === 'string') {
                    flattened.push([`${name}-${shade}`, shadeValue]);
                }
            }
        }
    }

    return flattened;
}

/**
 * Format a color name for the WordPress editor.
 */
export function formatColorName(
    name: string,
    shadeLabels?: Record<string, string>
): string {
    const parts = name.split('-');
    const colorName = parts[0];
    const shade = parts.length > 1 ? parts.slice(1).join(' ') : undefined;

    const capitalizedColor =
        colorName.charAt(0).toUpperCase() + colorName.slice(1);

    if (!shade) return capitalizedColor;

    if (shadeLabels && shade in shadeLabels) {
        return `${shadeLabels[shade]} ${capitalizedColor}`;
    }

    if (Number.isNaN(Number(shade))) {
        const capitalizedShade = shade
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        return `${capitalizedColor} (${capitalizedShade})`;
    }

    return `${capitalizedColor} (${shade})`;
}

/**
 * Resolve colors from @theme variables and Tailwind config.
 */
export function resolveColors(
    themeVariables: Array<[string, string]>,
    tailwindColors: Record<string, unknown> | undefined,
    shadeLabels?: Record<string, string>
): ColorPalette[] {
    const entries: ColorPalette[] = [];

    for (const [name, value] of themeVariables) {
        entries.push({
            name: formatColorName(name, shadeLabels),
            slug: name.toLowerCase(),
            color: value,
        });
    }

    if (tailwindColors) {
        for (const [name, value] of flattenColors(tailwindColors)) {
            entries.push({
                name: formatColorName(name, shadeLabels),
                slug: name.toLowerCase(),
                color: value,
            });
        }
    }

    return entries;
}
