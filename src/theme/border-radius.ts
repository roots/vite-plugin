import type { BorderRadiusSize } from '../types.js';
import { convertToRem } from '../utils.js';

/**
 * Determine if the value is a static CSS border-radius value.
 */
export function isStaticRadiusValue(value: string): boolean {
    return !/\(/.test(value.trim());
}

/**
 * Parse a border-radius size to rem for sorting.
 */
export function parseRadiusSizeForSort(size: string): number | null {
    const firstValue = size.trim().split(/\s+/)[0];
    const result = convertToRem(firstValue);

    if (result === 0 && parseFloat(firstValue) !== 0) return null;

    return result;
}

/**
 * Sort border radius sizes from smallest to largest.
 */
export function sortBorderRadiusSizes(
    sizes: BorderRadiusSize[]
): BorderRadiusSize[] {
    return [...sizes].sort((a, b) => {
        const sizeA = parseRadiusSizeForSort(a.size);
        const sizeB = parseRadiusSizeForSort(b.size);

        if (sizeA === null && sizeB === null) return 0;
        if (sizeA === null) return 1;
        if (sizeB === null) return -1;

        return sizeA - sizeB;
    });
}

/**
 * Processes border radius sizes from Tailwind config into theme.json format.
 */
export function processBorderRadiusSizes(
    sizes: Record<string, string>,
    borderRadiusLabels?: Record<string, string>
): BorderRadiusSize[] {
    return Object.entries(sizes)
        .filter(([, value]) => isStaticRadiusValue(value))
        .map(([name, value]) => {
            const displayName = borderRadiusLabels?.[name] ?? name;

            return {
                name: displayName,
                slug: name.toLowerCase(),
                size: value,
            };
        });
}

/**
 * Resolve border radius sizes from @theme variables and Tailwind config.
 */
export function resolveBorderRadii(
    variables: Array<[string, string]>,
    tailwindRadius: Record<string, string> | undefined,
    borderRadiusLabels?: Record<string, string>
): BorderRadiusSize[] {
    const entries: BorderRadiusSize[] = [];

    for (const [name, value] of variables) {
        if (!isStaticRadiusValue(value)) continue;

        const displayName = borderRadiusLabels?.[name] ?? name;

        entries.push({
            name: displayName,
            slug: name.toLowerCase(),
            size: value,
        });
    }

    if (tailwindRadius) {
        entries.push(
            ...processBorderRadiusSizes(tailwindRadius, borderRadiusLabels)
        );
    }

    return entries;
}
