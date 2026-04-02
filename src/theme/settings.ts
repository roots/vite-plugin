import type {
    ThemeJsonSettings,
    ColorPalette,
    FontFamily,
    FontSize,
    BorderRadiusSize,
} from '../types.js';
import { sortFontSizes } from './font-sizes.js';
import { sortBorderRadiusSizes } from './border-radius.js';

/**
 * Deduplicate entries by slug, keeping the first occurrence.
 */
export function dedupeBySlug<T extends { slug: string }>(entries: T[]): T[] {
    const seen = new Set<string>();
    return entries.filter((entry) => {
        if (seen.has(entry.slug)) return false;
        seen.add(entry.slug);
        return true;
    });
}

/**
 * Build the theme.json settings from base settings and generated entries.
 */
export function buildSettings(params: {
    baseSettings: ThemeJsonSettings;
    colors: ColorPalette[] | undefined;
    fonts: FontFamily[] | undefined;
    fontSizes: FontSize[] | undefined;
    borderRadii: BorderRadiusSize[] | undefined;
    disabled: {
        colors?: boolean;
        fonts?: boolean;
        fontSizes?: boolean;
        borderRadius?: boolean;
    };
}): ThemeJsonSettings {
    const { baseSettings, colors, fonts, fontSizes, borderRadii, disabled } =
        params;

    const settings: ThemeJsonSettings = {
        ...baseSettings,
        color: disabled.colors
            ? baseSettings?.color
            : {
                  ...baseSettings?.color,
                  palette: dedupeBySlug([
                      ...(baseSettings?.color?.palette || []),
                      ...(colors || []),
                  ]),
              },
        typography: {
            ...baseSettings?.typography,
            defaultFontSizes:
                baseSettings?.typography?.defaultFontSizes ?? false,
            customFontSize:
                baseSettings?.typography?.customFontSize ?? false,
            fontFamilies: disabled.fonts
                ? baseSettings?.typography?.fontFamilies
                : dedupeBySlug([
                      ...(baseSettings?.typography?.fontFamilies || []),
                      ...(fonts || []),
                  ]),
            fontSizes: disabled.fontSizes
                ? baseSettings?.typography?.fontSizes
                : sortFontSizes(
                      dedupeBySlug([
                          ...(baseSettings?.typography?.fontSizes || []),
                          ...(fontSizes || []),
                      ])
                  ),
        },
    };

    // Handle border radius
    if (disabled.borderRadius) {
        if (baseSettings?.border) {
            settings.border = baseSettings.border;
        }
    } else {
        const mergedRadiusSizes = sortBorderRadiusSizes(
            dedupeBySlug([
                ...(baseSettings?.border?.radiusSizes || []),
                ...(borderRadii || []),
            ])
        );

        if (mergedRadiusSizes.length === 0) {
            if (baseSettings?.border) {
                settings.border = baseSettings.border;
            }
        } else {
            settings.border = {
                ...baseSettings?.border,
                radius: baseSettings?.border?.radius ?? true,
                radiusSizes: mergedRadiusSizes,
            };
        }
    }

    return settings;
}
