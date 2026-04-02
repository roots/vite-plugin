/**
 * WordPress packages that are bundled and should NOT be externalized.
 *
 * @see https://github.com/WordPress/gutenberg/blob/trunk/packages/dependency-extraction-webpack-plugin/lib/util.js
 */
export const EXEMPT_PACKAGES = [
    '@wordpress/admin-ui',
    '@wordpress/dataviews',
    '@wordpress/dataviews/wp',
    '@wordpress/icons',
    '@wordpress/interface',
    '@wordpress/undo-manager',
    '@wordpress/fields',
    '@wordpress/views',
    '@wordpress/ui',
] as const;

/**
 * CSS-wide keywords to exclude from theme values.
 */
export const CSS_WIDE_KEYWORDS = [
    'initial',
    'inherit',
    'unset',
    'revert',
    'revert-layer',
] as const;

/**
 * Font-related CSS properties that should NOT be treated as font families.
 */
export const INVALID_FONT_PROPS = [
    'feature-settings',
    'variation-settings',
    'family',
    'size',
    'smoothing',
    'style',
    'weight',
    'stretch',
] as const;

/**
 * Text-related CSS properties that should NOT be treated as font sizes.
 */
export const INVALID_TEXT_PROPS = [
    'line-height',
    'letter-spacing',
    'font-weight',
    'shadow',
] as const;

/**
 * Supported file extensions for WordPress imports transformation
 */
export const SUPPORTED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs'] as const;

/**
 * Regex patterns for extracting CSS custom properties from @theme blocks.
 */
export const CSS_VARIABLE_PATTERNS = {
    COLOR: /(?:^|[;{}])\s*--color-([^:]+):\s*([^;}]+)/gm,
    FONT_FAMILY: /(?:^|[;{}])\s*--font-([^:]+):\s*([^;}]+)/gm,
    FONT_SIZE: /(?:^|[;{}])\s*--text-([^:]+):\s*([^;}]+)/gm,
    BORDER_RADIUS: /(?:^|[;{}])\s*--radius-([^:]+):\s*([^;}]+)/gm,
} as const;
