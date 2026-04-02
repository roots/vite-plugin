import path from 'path';
import type { TailwindTheme, TailwindConfig } from '../types.js';

/**
 * Merge base theme with extended theme properties.
 */
export function mergeThemeWithExtend(theme: TailwindTheme): TailwindTheme {
    if (!theme.extend) return theme;

    return {
        ...theme,
        colors: {
            ...theme.colors,
            ...theme.extend.colors,
        },
        fontFamily: {
            ...theme.fontFamily,
            ...theme.extend.fontFamily,
        },
        fontSize: {
            ...theme.fontSize,
            ...theme.extend.fontSize,
        },
        borderRadius: {
            ...theme.borderRadius,
            ...theme.extend.borderRadius,
        },
    };
}

/**
 * Load and resolve a Tailwind configuration file.
 */
export async function loadTailwindConfig(
    configPath: string
): Promise<TailwindConfig> {
    try {
        const absolutePath = path.resolve(configPath);

        const config = await import(absolutePath);
        const resolvedConfig = config.default || config;

        if (resolvedConfig.theme?.extend) {
            resolvedConfig.theme = mergeThemeWithExtend(resolvedConfig.theme);
        }

        return resolvedConfig;
    } catch (error) {
        throw new Error(
            `Failed to load Tailwind config from ${configPath}: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}
