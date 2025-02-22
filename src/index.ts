import {
    defaultRequestToExternal,
    defaultRequestToHandle,
} from '@wordpress/dependency-extraction-webpack-plugin/lib/util.js';
import type { Plugin as VitePlugin } from 'vite';
import type { InputOptions } from 'rollup';
import fs from 'fs';
import path from 'path';

interface ThemeJsonPluginOptions {
    /**
     * Path to the Tailwind configuration file.
     * This is used as a source of truth for generating theme.json settings.
     * If not provided, only CSS variables from the @theme block will be processed.
     *
     * @example './tailwind.config.js'
     */
    tailwindConfig?: string;

    /**
     * Labels for color shades to use in the WordPress editor.
     * Keys should be shade numbers (e.g. 50, 100, 500) and values are the human-readable labels.
     * For example: { 50: 'Lightest', 100: 'Lighter', 500: 'Default' }
     * When provided, color names will be formatted as '{label} {color}' instead of '{color} ({shade})'.
     */
    shadeLabels?: Record<string, string>;

    /**
     * Whether to disable generating color palette entries in theme.json.
     * When true, no color variables will be processed from the @theme block.
     *
     * @default false
     */
    disableTailwindColors?: boolean;

    /**
     * Whether to disable generating font family entries in theme.json.
     * When true, no font-family variables will be processed from the @theme block.
     *
     * @default false
     */
    disableTailwindFonts?: boolean;

    /**
     * Whether to disable generating font size entries in theme.json.
     * When true, no font-size variables will be processed from the @theme block.
     *
     * @default false
     */
    disableTailwindFontSizes?: boolean;
}

interface ColorPalette {
    /**
     * The human-readable name of the color.
     * This will be displayed in the WordPress editor.
     */
    name: string;

    /**
     * The machine-readable identifier for the color.
     * This should be lowercase and URL-safe.
     */
    slug: string;

    /**
     * The CSS color value.
     * Can be any valid CSS color format (hex, rgb, hsl, etc).
     */
    color: string;
}

interface FontFamily {
    /**
     * The human-readable name of the font family.
     * This will be displayed in the WordPress editor.
     */
    name: string;

    /**
     * The machine-readable identifier for the font family.
     * This should be lowercase and URL-safe.
     */
    slug: string;

    /**
     * The CSS font-family value.
     * Can include fallback fonts (e.g. '"Inter", sans-serif').
     */
    fontFamily: string;
}

interface FontSize {
    /**
     * The human-readable name of the font size.
     * This will be displayed in the WordPress editor.
     */
    name: string;

    /**
     * The machine-readable identifier for the font size.
     * This should be lowercase and URL-safe.
     */
    slug: string;

    /**
     * The CSS font-size value.
     * Can be any valid CSS size unit (px, rem, em, etc).
     */
    size: string;
}

interface ThemeJsonSettings {
    /**
     * Color settings including the color palette.
     * Generated from --color-* CSS variables in the @theme block.
     */
    color?: {
        palette: ColorPalette[];
    };

    /**
     * Typography settings including font families and sizes.
     * Generated from --font-* and --text-* CSS variables in the @theme block.
     */
    typography: {
        /**
         * Whether to include WordPress's default font sizes.
         *
         * @default false
         */
        defaultFontSizes: boolean;

        /**
         * Whether to allow custom font size input.
         *
         * @default false
         */
        customFontSize: boolean;

        /**
         * Available font families in the editor.
         * Generated from --font-* CSS variables.
         */
        fontFamilies?: FontFamily[];

        /**
         * Available font sizes in the editor.
         * Generated from --text-* CSS variables.
         */
        fontSizes?: FontSize[];
    };
}

interface ThemeJson {
    /**
     * Internal flag indicating the file was processed by the plugin.
     */
    __processed__?: string;

    /**
     * Theme.json settings object containing colors, typography, etc.
     */
    settings: ThemeJsonSettings;

    /**
     * Additional theme.json properties that will be preserved.
     */
    [key: string]: unknown;
}

/**
 * Supported file extensions for WordPress imports transformation
 */
const SUPPORTED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'] as const;
type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/**
 * Configuration for the WordPress plugin
 */
interface WordPressPluginConfig {
    /**
     * File extensions to process for WordPress imports.
     *
     * @default ['.js', '.jsx', '.ts', '.tsx']
     */
    extensions?: SupportedExtension[];

    /**
     * HMR configuration for the WordPress editor
     */
    hmr?: {
        /**
         * Pattern to match editor entry points.
         * Can be a string (exact match) or RegExp.
         *
         * @default /editor/
         */
        editorPattern?: string | RegExp;

        /**
         * Pattern to match editor CSS files.
         * Can be a string (exact match) or RegExp.
         *
         * @default 'editor.css'
         */
        cssPattern?: string | RegExp;

        /**
         * Whether to enable HMR for the WordPress editor.
         *
         * @default true
         */
        enabled?: boolean;

        /**
         * Name of the editor iframe element.
         *
         * @default 'editor-canvas'
         */
        iframeName?: string;
    };
}

/**
 * Creates a Vite plugin that handles WordPress dependencies.
 * This plugin transforms @wordpress/* imports into global wp.* references,
 * generates a dependency manifest for WordPress enqueuing, and handles
 * external dependencies.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { wordpressPlugin } from '@wordpress/vite-plugin'
 *
 * export default defineConfig({
 *   plugins: [
 *     wordpressPlugin()
 *   ]
 * })
 * ```
 *
 * The plugin will:
 * 1. Transform imports like `import { useState } from '@wordpress/element'`
 *    into `const useState = wp.element.useState`
 * 2. Track WordPress script dependencies (e.g. 'wp-element')
 * 3. Generate an editor.deps.json file listing all dependencies
 * 4. Mark all @wordpress/* packages as external dependencies
 * 5. Prevent WordPress core libraries from being bundled
 *
 * @returns A Vite plugin configured to handle WordPress dependencies
 */
export function wordpressPlugin(
    config: WordPressPluginConfig = {}
): VitePlugin {
    const extensions = config.extensions ?? SUPPORTED_EXTENSIONS;
    const dependencies = new Set<string>();

    // HMR configuration with defaults
    const hmrConfig = {
        enabled: true,
        editorPattern: /editor/,
        cssPattern: 'editor.css',
        iframeName: 'editor-canvas',
        ...config.hmr,
    };

    // HMR code to inject
    const hmrCode = `
if (import.meta.hot) {
    import.meta.hot.on('vite:beforeUpdate', (payload) => {
        const cssUpdates = payload.updates.filter(update => update.type === 'css-update');

        if (cssUpdates.length > 0) {
            const update = cssUpdates[0];

            // Find the iframe
            const editorIframe = document.querySelector('iframe[name="${hmrConfig.iframeName}"]');
            if (!editorIframe?.contentDocument) {
                window.location.reload();
                return;
            }

            // Find the existing style tag in the iframe
            const styles = editorIframe.contentDocument.getElementsByTagName('style');
            let editorStyle = null;
            for (const style of styles) {
                if (style.textContent.includes('${hmrConfig.cssPattern}')) {
                    editorStyle = style;
                    break;
                }
            }

            if (!editorStyle) {
                window.location.reload();
                return;
            }

            // Update the style content with new import and cache-busting timestamp
            const timestamp = Date.now();
            editorStyle.textContent = \`@import url('\${window.__vite_client_url}\${update.path}?t=\${timestamp}')\`;
            return;
        }

        // For non-CSS updates, reload
        window.location.reload();
    });
}`;

    /**
     * Extracts named imports from a WordPress import statement.
     * Handles both single and multiple imports with aliases.
     */
    function extractNamedImports(imports: string): string[] {
        return (
            imports
                .match(/{([^}]+)}/)
                ?.at(1)
                ?.split(',')
                .map((s) => s.trim())
                .filter(Boolean) ?? []
        );
    }

    /**
     * Transforms WordPress named imports into global variable assignments.
     * Handles both direct imports and aliased imports.
     */
    function handleNamedReplacement(
        namedImports: string[],
        external: string[]
    ): string {
        const externalPath = external.join('.');

        return namedImports
            .map((importStr) => {
                const parts = importStr.split(' as ').map((s) => s.trim());
                const name = parts[0];
                const alias = parts[1] ?? name;

                return `const ${alias} = ${externalPath}.${name};`;
            })
            .join('\n');
    }

    return {
        name: 'wordpress-plugin',
        enforce: 'pre',

        options(opts: InputOptions) {
            return {
                ...opts,
                external: (id: string): boolean =>
                    typeof id === 'string' && id.startsWith('@wordpress/'),
            };
        },

        resolveId(id: string) {
            if (!id?.startsWith('@wordpress/')) return null;

            const [external, handle] = [
                defaultRequestToExternal(id),
                defaultRequestToHandle(id),
            ];

            if (!external || !handle) return null;

            dependencies.add(handle);
            return { id, external: true };
        },

        transform(code: string, id: string) {
            if (!extensions.some((ext) => id.endsWith(ext))) return null;

            let transformedCode = code;

            // Handle all WordPress imports
            const importRegex =
                /^[\s\n]*import[\s\n]+(?:([^;'"]+?)[\s\n]+from[\s\n]+)?['"]@wordpress\/([^'"]+)['"][\s\n]*;?/gm;
            let match;

            while ((match = importRegex.exec(code)) !== null) {
                const [fullMatch, imports, pkg] = match;

                const external = defaultRequestToExternal(`@wordpress/${pkg}`);
                const handle = defaultRequestToHandle(`@wordpress/${pkg}`);

                if (!external || !handle) continue;

                // Add dependency
                dependencies.add(handle);

                // For side-effect only imports, just remove them
                if (!imports) {
                    transformedCode = transformedCode.replace(fullMatch, '');
                    continue;
                }

                // Handle different import types
                let replacement;

                if (imports.includes('{')) {
                    // Named imports
                    replacement = handleNamedReplacement(
                        extractNamedImports(imports),
                        external
                    );
                } else if (imports.includes('*')) {
                    // Namespace imports
                    const namespaceAlias =
                        imports.match(/\*\s+as\s+(\w+)/)?.[1];

                    if (namespaceAlias) {
                        replacement = `const ${namespaceAlias} = ${external.join(
                            '.'
                        )};`;
                    }
                } else {
                    // Default imports
                    const defaultImport = imports.match(/^(\w+)/)?.[1];

                    if (defaultImport) {
                        replacement = `const ${defaultImport} = ${external.join(
                            '.'
                        )};`;
                    }
                }

                if (replacement) {
                    transformedCode = transformedCode.replace(
                        fullMatch,
                        replacement
                    );
                }
            }

            // Inject HMR code if this is the editor entry point
            if (
                hmrConfig.enabled &&
                !transformedCode.includes('vite:beforeUpdate') &&
                ((typeof hmrConfig.editorPattern === 'string' &&
                    id.includes(hmrConfig.editorPattern)) ||
                    (hmrConfig.editorPattern instanceof RegExp &&
                        hmrConfig.editorPattern.test(id)))
            ) {
                transformedCode = `${transformedCode}\n${hmrCode}`;
            }

            return {
                code: transformedCode,
                map: null,
            };
        },

        generateBundle() {
            this.emitFile({
                type: 'asset',
                name: 'editor.deps.json',
                originalFileName: 'editor.deps.json',
                source: JSON.stringify([...dependencies], null, 2),
            });
        },
    };
}

/**
 * Configuration for the WordPress theme.json plugin
 */
interface ThemeJsonConfig extends ThemeJsonPluginOptions {
    /**
     * The Tailwind configuration object containing design tokens.
     * This is used as a source of truth for generating theme.json settings.
     * If not provided, only CSS variables from the @theme block will be processed.
     */
    tailwindConfig?: string;

    /**
     * The path to the base theme.json file.
     *
     * @default './theme.json'
     */
    baseThemeJsonPath?: string;

    /**
     * The path where the generated theme.json will be written.
     *
     * @default 'assets/theme.json'
     */
    outputPath?: string;

    /**
     * The CSS file to process for theme variables.
     *
     * @default 'app.css'
     */
    cssFile?: string;
}

interface TailwindTheme {
    colors?: Record<string, unknown>;
    fontFamily?: Record<string, string[] | string>;
    fontSize?: Record<string, string | [string, Record<string, string>]>;
    extend?: {
        colors?: Record<string, unknown>;
        fontFamily?: Record<string, string[] | string>;
        fontSize?: Record<string, string | [string, Record<string, string>]>;
    };
}

interface TailwindConfig {
    theme?: TailwindTheme;
}

/**
 * Merges base theme with extended theme properties
 */
function mergeThemeWithExtend(theme: TailwindTheme): TailwindTheme {
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
    };
}

/**
 * Flattens a nested color object into an array of [name, value] pairs
 */
function flattenColors(
    colors: Record<string, unknown>
): Array<[string, string]> {
    const flattened: Array<[string, string]> = [];

    for (const [name, value] of Object.entries(colors)) {
        if (typeof value === 'string') {
            flattened.push([name, value]);
        } else if (typeof value === 'object' && value !== null) {
            // Handle nested color objects (e.g. { orange: { 500: '#...' } })
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
 * Processes font families from Tailwind config into theme.json format
 */
function processFontFamilies(
    fonts: Record<string, string[] | string>
): Array<{ name: string; slug: string; fontFamily: string }> {
    return Object.entries(fonts).map(([name, value]) => {
        const fontFamily = Array.isArray(value) ? value.join(', ') : value;

        return {
            name: name,
            slug: name.toLowerCase(),
            fontFamily,
        };
    });
}

/**
 * Processes font sizes from Tailwind config into theme.json format
 */
function processFontSizes(
    sizes: Record<string, string | [string, Record<string, string>]>
): Array<{ name: string; slug: string; size: string }> {
    return Object.entries(sizes).map(([name, value]) => {
        // Handle both simple sizes and sizes with line height config
        const size = Array.isArray(value) ? value[0] : value;

        return {
            name: name,
            slug: name.toLowerCase(),
            size,
        };
    });
}

/**
 * Loads and resolves the Tailwind configuration from the provided path
 */
async function loadTailwindConfig(configPath: string): Promise<TailwindConfig> {
    try {
        const absolutePath = path.resolve(configPath);
        const config = await import(absolutePath);
        const resolvedConfig = config.default || config;

        // Merge extended theme properties if they exist
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

/**
 * Creates a Vite plugin that generates a WordPress theme.json file from Tailwind CSS variables.
 * This allows theme.json settings to stay in sync with your Tailwind design tokens.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { wordpressThemeJson } from '@wordpress/vite-plugin'
 * import tailwindConfig from './tailwind.config.js'
 *
 * export default defineConfig({
 *   plugins: [
 *     wordpressThemeJson({
 *       disableTailwindColors: false,
 *       disableTailwindFonts: false,
 *       disableTailwindFontSizes: false,
 *     }),
 *   ]
 * })
 * ```
 *
 * CSS variables in an @theme block will be transformed into theme.json:
 * ```css
 * @theme {
 *   --color-primary: #000000;  ->  { name: "primary", color: "#000000" }
 *   --color-red-500: #ef4444;  ->  { name: "red-500", color: "#ef4444" }
 *   --font-inter: "Inter";       ->  { name: "inter", fontFamily: "Inter" }
 *   --text-lg: 1.125rem;         ->  { name: "lg", size: "1.125rem" }
 * }
 * ```
 *
 * @param options - Configuration options for the theme.json generator
 * @returns A Vite plugin configured to generate theme.json from CSS variables
 */
export function wordpressThemeJson(config: ThemeJsonConfig = {}): VitePlugin {
    const {
        tailwindConfig,
        disableTailwindColors = false,
        disableTailwindFonts = false,
        disableTailwindFontSizes = false,
        baseThemeJsonPath = './theme.json',
        outputPath = 'assets/theme.json',
        cssFile = 'app.css',
    } = config;

    let cssContent: string | null = null;
    let resolvedTailwindConfig: TailwindConfig | undefined;

    if (tailwindConfig !== undefined && typeof tailwindConfig !== 'string') {
        throw new Error('tailwindConfig must be a string path or undefined');
    }

    /**
     * Safely extracts CSS content between matched braces while handling:
     * - Nested braces within the block
     * - String literals (both single and double quotes)
     * - CSS comments
     * - Escaped characters
     */
    function extractThemeContent(css: string): string | null {
        const themeMatch = css.match(/@(?:layer\s+)?theme\s*{/s);

        if (!themeMatch?.index) return null;

        const startIndex = themeMatch.index + themeMatch[0].length;

        // Define token types we need to handle
        const tokens = {
            ESCAPE: { pattern: '\\', skip: 1 },
            STRING: { pattern: /['"]/, handleUntil: (quote: string) => quote },
            COMMENT: { pattern: '/*', handleUntil: '*/' },
            OPEN_BRACE: { pattern: '{', count: 1 },
            CLOSE_BRACE: { pattern: '}', count: -1 },
        } as const;

        let braceCount = 1;
        let position = startIndex;

        while (position < css.length) {
            // Handle escaped characters
            if (css[position] === tokens.ESCAPE.pattern) {
                position += tokens.ESCAPE.skip + 1;
                continue;
            }

            // Handle string literals
            if (/['"]/.test(css[position])) {
                const quote = css[position];
                position++;

                while (position < css.length) {
                    if (css[position] === tokens.ESCAPE.pattern) {
                        position += tokens.ESCAPE.skip + 1;
                    } else if (css[position] === quote) {
                        position++;
                        break;
                    } else {
                        position++;
                    }
                }

                continue;
            }

            // Handle comments
            if (css.slice(position, position + 2) === '/*') {
                position += 2;

                while (position < css.length) {
                    if (css.slice(position, position + 2) === '*/') {
                        position += 2;
                        break;
                    }

                    position++;
                }

                continue;
            }

            // Handle braces
            if (css[position] === '{') braceCount++;
            if (css[position] === '}') braceCount--;

            if (braceCount === 0) {
                return css.substring(startIndex, position);
            }

            position++;
        }

        // If we get here, we have an unclosed block
        const blockType = themeMatch[0].trim();
        throw new Error(`Unclosed ${blockType} block - missing closing brace`);
    }

    return {
        name: 'wordpress-theme-json',
        enforce: 'post',

        async configResolved() {
            if (tailwindConfig) {
                resolvedTailwindConfig = await loadTailwindConfig(
                    tailwindConfig
                );
            }
        },

        transform(code: string, id: string) {
            if (id.includes(cssFile)) {
                cssContent = code;
            }

            return null;
        },

        async generateBundle() {
            try {
                const baseThemeJson = JSON.parse(
                    fs.readFileSync(path.resolve(baseThemeJsonPath), 'utf8')
                ) as ThemeJson;

                // Extract theme content if CSS is available
                const themeContent = cssContent
                    ? extractThemeContent(cssContent)
                    : null;

                // If no @theme block and no Tailwind config, nothing to do
                if (!themeContent && !resolvedTailwindConfig) return;

                /**
                 * Helper to extract CSS variables using a regex pattern
                 */
                const extractVariables = (
                    regex: RegExp,
                    content: string | null
                ) => {
                    if (!content) return [];

                    const variables: Array<[string, string]> = [];
                    let match: RegExpExecArray | null;

                    while ((match = regex.exec(content)) !== null) {
                        const [, name, value] = match;

                        if (name && value) variables.push([name, value.trim()]);
                    }

                    return variables;
                };

                const patterns = {
                    COLOR: /--color-([^:]+):\s*([^;}]+)[;}]?/g,
                    FONT_FAMILY: /--font-([^:]+):\s*([^;}]+)[;}]?/g,
                    FONT_SIZE: /--text-([^:]+):\s*([^;}]+)[;}]?/g,
                } as const;

                // Process colors from either @theme block or Tailwind config
                const colorEntries = !disableTailwindColors
                    ? [
                          // Process @theme block colors if available
                          ...extractVariables(patterns.COLOR, themeContent)
                              .filter(([name]) => !name.endsWith('-*'))
                              .map(([name, value]) => {
                                  const [colorName, shade] = name.split('-');
                                  const capitalizedColor =
                                      colorName.charAt(0).toUpperCase() +
                                      colorName.slice(1);
                                  const displayName =
                                      shade && !Number.isNaN(Number(shade))
                                          ? config.shadeLabels &&
                                            shade in config.shadeLabels
                                              ? `${config.shadeLabels[shade]} ${capitalizedColor}`
                                              : `${capitalizedColor} (${shade})`
                                          : capitalizedColor;

                                  return {
                                      name: displayName,
                                      slug: name.toLowerCase(),
                                      color: value,
                                  };
                              }),
                          // Process Tailwind config colors if available
                          ...(resolvedTailwindConfig?.theme?.colors
                              ? flattenColors(
                                    resolvedTailwindConfig.theme.colors
                                ).map(([name, value]) => {
                                    const [colorName, shade] = name.split('-');
                                    const capitalizedColor =
                                        colorName.charAt(0).toUpperCase() +
                                        colorName.slice(1);
                                    const displayName =
                                        shade && !Number.isNaN(Number(shade))
                                            ? config.shadeLabels &&
                                              shade in config.shadeLabels
                                                ? `${config.shadeLabels[shade]} ${capitalizedColor}`
                                                : `${capitalizedColor} (${shade})`
                                            : capitalizedColor;

                                    return {
                                        name: displayName,
                                        slug: name.toLowerCase(),
                                        color: value,
                                    };
                                })
                              : []),
                      ]
                    : undefined;

                const invalidFontProps = [
                    'feature-settings',
                    'variation-settings',
                    'family',
                    'size',
                    'smoothing',
                    'style',
                    'weight',
                    'stretch',
                ];

                const fontFamilyEntries = !disableTailwindFonts
                    ? [
                          // Process @theme block font families if available
                          ...extractVariables(
                              patterns.FONT_FAMILY,
                              themeContent
                          )
                              .filter(
                                  ([name]) =>
                                      !invalidFontProps.some((prop) =>
                                          name.includes(prop)
                                      )
                              )
                              .map(([name, value]) => ({
                                  name: name,
                                  slug: name.toLowerCase(),
                                  fontFamily: value.replace(/['"]/g, ''),
                              })),
                          // Process Tailwind config font families if available
                          ...(resolvedTailwindConfig?.theme?.fontFamily
                              ? processFontFamilies(
                                    resolvedTailwindConfig.theme.fontFamily
                                )
                              : []),
                      ]
                    : undefined;

                // Process font sizes from either @theme block or Tailwind config
                const fontSizeEntries = !disableTailwindFontSizes
                    ? [
                          // Process @theme block font sizes if available
                          ...extractVariables(patterns.FONT_SIZE, themeContent)
                              .filter(([name]) => !name.includes('line-height'))
                              .map(([name, value]) => ({
                                  name: name,
                                  slug: name.toLowerCase(),
                                  size: value,
                              })),
                          // Process Tailwind config font sizes if available
                          ...(resolvedTailwindConfig?.theme?.fontSize
                              ? processFontSizes(
                                    resolvedTailwindConfig.theme.fontSize
                                )
                              : []),
                      ]
                    : undefined;

                // Build theme.json
                const themeJson: ThemeJson = {
                    __processed__: 'This file was generated using Vite',
                    ...baseThemeJson,
                    settings: {
                        ...baseThemeJson.settings,
                        color: disableTailwindColors
                            ? undefined
                            : {
                                  ...baseThemeJson.settings?.color,
                                  palette: [
                                      ...(baseThemeJson.settings?.color
                                          ?.palette || []),
                                      ...(colorEntries || []),
                                  ],
                              },
                        typography: {
                            ...baseThemeJson.settings?.typography,
                            defaultFontSizes: false,
                            customFontSize: false,
                            fontFamilies: disableTailwindFonts
                                ? undefined
                                : [
                                      ...(baseThemeJson.settings?.typography
                                          ?.fontFamilies || []),
                                      ...(fontFamilyEntries || []),
                                  ],
                            fontSizes: disableTailwindFontSizes
                                ? undefined
                                : [
                                      ...(baseThemeJson.settings?.typography
                                          ?.fontSizes || []),
                                      ...(fontSizeEntries || []),
                                  ],
                        },
                    },
                };

                delete themeJson.__preprocessed__;

                this.emitFile({
                    type: 'asset',
                    fileName: outputPath,
                    source: JSON.stringify(themeJson, null, 2),
                });
            } catch (error) {
                throw error instanceof Error ? error : new Error(String(error));
            }
        },
    };
}
