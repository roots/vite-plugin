export interface ThemeJsonPluginOptions {
    /**
     * Path to the Tailwind configuration file.
     *
     * @example './tailwind.config.js'
     */
    tailwindConfig?: string;

    /**
     * Map shade numbers to human-readable labels for the editor.
     *
     * @example { 50: 'Lightest', 500: 'Default' }
     */
    shadeLabels?: Record<string, string>;

    /**
     * Map font identifiers to human-readable labels for the editor.
     *
     * @example { sans: 'Sans Serif', mono: 'Monospace' }
     */
    fontLabels?: Record<string, string>;

    /**
     * Map font size identifiers to human-readable labels for the editor.
     *
     * @example { sm: 'Small', lg: 'Large' }
     */
    fontSizeLabels?: Record<string, string>;

    /**
     * Map border radius identifiers to human-readable labels for the editor.
     *
     * @example { sm: 'Small', full: 'Full' }
     */
    borderRadiusLabels?: Record<string, string>;

    /**
     * Disable color palette generation.
     *
     * @default false
     */
    disableTailwindColors?: boolean;

    /**
     * Disable font family generation.
     *
     * @default false
     */
    disableTailwindFonts?: boolean;

    /**
     * Disable font size generation.
     *
     * @default false
     */
    disableTailwindFontSizes?: boolean;

    /**
     * Disable border radius generation.
     *
     * @default false
     */
    disableTailwindBorderRadius?: boolean;
}

export interface ColorPalette {
    name: string;
    slug: string;
    color: string;
}

export interface FontFamily {
    name: string;
    slug: string;
    fontFamily: string;
}

export interface FontSize {
    name: string;
    slug: string;
    size: string;
}

export interface BorderRadiusSize {
    name: string;
    slug: string;
    size: string;
}

export interface ThemeJsonSettings {
    color?: {
        palette: ColorPalette[];
    };

    border?: {
        radius?: boolean;
        radiusSizes?: BorderRadiusSize[];
        [key: string]: unknown;
    };

    typography: {
        defaultFontSizes: boolean;
        customFontSize: boolean;
        fontFamilies?: FontFamily[];
        fontSizes?: FontSize[];
    };
}

export interface ThemeJson {
    __processed__?: string;
    /** @internal */
    __preprocessed__?: string;
    settings: ThemeJsonSettings;
    [key: string]: unknown;
}

/**
 * Configuration for the theme.json generator plugin.
 */
export interface ThemeJsonConfig extends ThemeJsonPluginOptions {
    tailwindConfig?: string;

    /**
     * Path to the base theme.json file.
     *
     * @default './theme.json'
     */
    baseThemeJsonPath?: string;

    /**
     * Output path for the generated theme.json.
     *
     * @default 'assets/theme.json'
     */
    outputPath?: string;

    /**
     * CSS file to process for @theme variables.
     *
     * @default 'app.css'
     */
    cssFile?: string;
}

import { SUPPORTED_EXTENSIONS } from './constants.js';

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export interface ExternalMapping {
    /**
     * Global path where the package is exposed.
     *
     * @example ['acf', 'input']
     */
    global: string[];

    /**
     * WordPress script handle for dependency enqueueing.
     *
     * @example 'acf-input'
     */
    handle: string;
}

/**
 * Configuration for the WordPress externals plugin.
 */
export interface WordPressPluginConfig {
    /**
     * File extensions to process.
     *
     * @default ['.js', '.jsx', '.ts', '.tsx', '.mjs']
     */
    extensions?: SupportedExtension[];

    /**
     * External mappings for non-WordPress packages that expose globals.
     *
     * @example
     * ```ts
     * {
     *   'acf-input': {
     *     global: ['acf', 'input'],
     *     handle: 'acf-input'
     *   }
     * }
     * ```
     */
    externalMappings?: Record<string, ExternalMapping>;

    /**
     * HMR configuration for the WordPress editor.
     */
    hmr?: {
        /**
         * Pattern to match editor entry points.
         *
         * @default /editor/
         */
        editorPattern?: string | RegExp;

        /**
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

export interface TailwindTheme {
    colors?: Record<string, unknown>;
    fontFamily?: Record<string, string[] | string>;
    fontSize?: Record<string, string | [string, Record<string, string>]>;
    borderRadius?: Record<string, string>;
    extend?: {
        colors?: Record<string, unknown>;
        fontFamily?: Record<string, string[] | string>;
        fontSize?: Record<string, string | [string, Record<string, string>]>;
        borderRadius?: Record<string, string>;
    };
}

export interface TailwindConfig {
    theme?: TailwindTheme;
}
