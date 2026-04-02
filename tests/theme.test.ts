/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('path');

import { wordpressThemeJson } from '../src/index.js';

describe('wordpressThemeJson', () => {
    const mockTailwindConfigPath = './tailwind.config.js';
    const mockTailwindConfig = {
        theme: {
            colors: {
                primary: '#000000',
                'red-500': '#ef4444',
            },
            fontFamily: {
                inter: ['Inter', 'sans-serif'],
                sans: ['system-ui', 'sans-serif'],
            },
            fontSize: {
                sm: '0.875rem',
                lg: '1.125rem',
            },
        },
    };

    const mockBaseThemeJson = {
        settings: {
            color: {
                palette: [],
            },
            typography: {
                fontFamilies: [],
                fontSizes: [],
            },
        },
    };

    beforeEach(() => {
        vi.mocked(fs.readFileSync).mockImplementation(
            (path: fs.PathOrFileDescriptor) => {
                if (
                    typeof path === 'string' &&
                    path.includes('tailwind.config.js')
                ) {
                    return `module.exports = ${JSON.stringify(
                        mockTailwindConfig
                    )}`;
                }

                return JSON.stringify(mockBaseThemeJson);
            }
        );

        vi.mocked(path.resolve).mockImplementation((...paths: string[]) =>
            paths.join('/')
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should process CSS variables from @theme block', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --color-primary: #000000;
        --color-red-500: #ef4444;
        --font-inter: "Inter";
        --text-lg: 1.125rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        expect(emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'assets/theme.json',
                source: expect.stringContaining('"name": "Primary"'),
            })
        );
    });

    it('should handle invalid tailwind config path', async () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: './nonexistent.config.js',
        });

        await expect((plugin.configResolved as any)?.()).rejects.toThrow(
            /Failed to load Tailwind config/
        );
    });

    it('should handle numeric color shades', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --color-red-500: #ef4444;
        --color-blue-100: #e0f2fe;
        --color-primary: #000000;
        --color-white: #ffffff;
        --color-black: #000000;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Red (500)',
            slug: 'red-500',
            color: '#ef4444',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Blue (100)',
            slug: 'blue-100',
            color: '#e0f2fe',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Primary',
            slug: 'primary',
            color: '#000000',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'White',
            slug: 'white',
            color: '#ffffff',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Black',
            slug: 'black',
            color: '#000000',
        });
    });

    it('should respect disable flags', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
            disableTailwindColors: true,
            disableTailwindFonts: true,
            disableTailwindFontSizes: true,
        });

        const cssContent = `
      @theme {
        --color-primary: #000000;
        --font-inter: "Inter";
        --text-lg: 1.125rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.color?.palette).toEqual([]);
        expect(themeJson.settings.typography.fontFamilies).toEqual([]);
        expect(themeJson.settings.typography.fontSizes).toEqual([]);
    });

    it('should handle invalid font properties', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --font-feature-settings: "ss01";
        --font-weight: 500;
        --font-inter: "Inter";
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);
        const fontFamilies = themeJson.settings.typography.fontFamilies;

        expect(fontFamilies).toHaveLength(1);
        expect(fontFamilies[0]).toEqual({
            name: 'inter',
            slug: 'inter',
            fontFamily: 'Inter',
        });
    });

    it('should still emit theme.json when @theme block is missing', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      .some-class {
        color: red;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        expect(emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'asset',
                fileName: 'assets/theme.json',
            })
        );
    });

    it('should handle malformed @theme block', async () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --color-primary: #000000;
        /* missing closing brace */
    `;

        (plugin.transform as any)(cssContent, 'app.css');
        const emitFile = vi.fn();

        await expect(
            (plugin.generateBundle as any).call({ emitFile })
        ).rejects.toThrow('Unclosed @theme { block - missing closing brace');
    });

    it('should handle shade labels', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
            shadeLabels: {
                '50': 'Lightest',
                '100': 'Lighter',
                '500': 'Default',
                '900': 'Darkest',
            },
        });

        const cssContent = `
      @theme {
        --color-blue-50: #f0f9ff;
        --color-blue-100: #e0f2fe;
        --color-blue-500: #3b82f6;
        --color-blue-900: #1e3a8a;
        --color-primary: #000000;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Lightest Blue',
            slug: 'blue-50',
            color: '#f0f9ff',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Lighter Blue',
            slug: 'blue-100',
            color: '#e0f2fe',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Default Blue',
            slug: 'blue-500',
            color: '#3b82f6',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Darkest Blue',
            slug: 'blue-900',
            color: '#1e3a8a',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Primary',
            slug: 'primary',
            color: '#000000',
        });
    });

    it('should format shades without labels as Color (shade)', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
            // No shade labels configured
        });

        const cssContent = `
      @theme {
        --color-blue-50: #f0f9ff;
        --color-blue-100: #e0f2fe;
        --color-red-500: #ef4444;
        --color-gray-900: #111827;
        --color-primary: #000000;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Blue (50)',
            slug: 'blue-50',
            color: '#f0f9ff',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Blue (100)',
            slug: 'blue-100',
            color: '#e0f2fe',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Red (500)',
            slug: 'red-500',
            color: '#ef4444',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Gray (900)',
            slug: 'gray-900',
            color: '#111827',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Primary',
            slug: 'primary',
            color: '#000000',
        });
    });

    it('should handle multi-hyphen color names', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --color-fancy-test-example: #123456;
        --color-button-hover-state: #234567;
        --color-social-twitter-blue: #1DA1F2;
        --color-primary: #000000;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Fancy (Test Example)',
            slug: 'fancy-test-example',
            color: '#123456',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Button (Hover State)',
            slug: 'button-hover-state',
            color: '#234567',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Social (Twitter Blue)',
            slug: 'social-twitter-blue',
            color: '#1DA1F2',
        });

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'Primary',
            slug: 'primary',
            color: '#000000',
        });
    });

    it('should preserve existing theme.json settings', () => {
        const existingThemeJson = {
            settings: {
                color: {
                    palette: [
                        {
                            name: 'existing-color',
                            slug: 'existing-color',
                            color: '#cccccc',
                        },
                    ],
                },
                typography: {
                    fontFamilies: [
                        {
                            name: 'existing-font',
                            slug: 'existing-font',
                            fontFamily: 'Arial',
                        },
                    ],
                    fontSizes: [
                        {
                            name: 'existing-size',
                            slug: 'existing-size',
                            size: '1rem',
                        },
                    ],
                },
            },
        };

        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify(existingThemeJson)
        );

        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --color-primary: #000000;
        --font-inter: "Inter";
        --text-lg: 1.125rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });
        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.color.palette).toContainEqual({
            name: 'existing-color',
            slug: 'existing-color',
            color: '#cccccc',
        });

        expect(themeJson.settings.typography.fontFamilies).toContainEqual({
            name: 'existing-font',
            slug: 'existing-font',
            fontFamily: 'Arial',
        });

        expect(themeJson.settings.typography.fontSizes).toContainEqual({
            name: 'existing-size',
            slug: 'existing-size',
            size: '1rem',
        });
    });

    it('should handle font labels', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
            fontLabels: {
                inter: 'Inter Font',
                sans: 'System Sans',
            },
        });

        const cssContent = `
      @theme {
        --font-inter: "Inter";
        --font-sans: "system-ui";
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.typography.fontFamilies).toContainEqual({
            name: 'Inter Font',
            slug: 'inter',
            fontFamily: 'Inter',
        });

        expect(themeJson.settings.typography.fontFamilies).toContainEqual({
            name: 'System Sans',
            slug: 'sans',
            fontFamily: 'system-ui',
        });
    });

    it('should handle font size labels', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
            fontSizeLabels: {
                sm: 'Small',
                lg: 'Large',
                '2xs': 'Extra Extra Small',
            },
        });

        const cssContent = `
      @theme {
        --text-sm: 0.875rem;
        --text-lg: 1.125rem;
        --text-2xs: 0.625rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.typography.fontSizes).toContainEqual({
            name: 'Small',
            slug: 'sm',
            size: '0.875rem',
        });

        expect(themeJson.settings.typography.fontSizes).toContainEqual({
            name: 'Large',
            slug: 'lg',
            size: '1.125rem',
        });

        expect(themeJson.settings.typography.fontSizes).toContainEqual({
            name: 'Extra Extra Small',
            slug: '2xs',
            size: '0.625rem',
        });
    });

    it('should handle missing font and font size labels', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --font-inter: "Inter";
        --text-2xs: 0.625rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.typography.fontFamilies).toContainEqual({
            name: 'inter',
            slug: 'inter',
            fontFamily: 'Inter',
        });

        expect(themeJson.settings.typography.fontSizes).toContainEqual({
            name: '2xs',
            slug: '2xs',
            size: '0.625rem',
        });
    });

    it('should sort font sizes from smallest to largest', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --text-4xl: 2.25rem;
        --text-sm: 0.875rem;
        --text-base: 1rem;
        --text-xs: 0.75rem;
        --text-2xl: 1.5rem;
        --text-lg: 1.125rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);
        const fontSizes = themeJson.settings.typography.fontSizes;

        // Verify the order is correct
        expect(fontSizes.map((f: { size: string }) => f.size)).toEqual([
            '0.75rem', // xs
            '0.875rem', // sm
            '1rem', // base
            '1.125rem', // lg
            '1.5rem', // 2xl
            '2.25rem', // 4xl
        ]);
    });

    it('should handle sorting of mixed units', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --text-px: 16px;
        --text-em: 1em;
        --text-rem: 1rem;
        --text-small: 12px;
        --text-large: 1.5rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);
        const fontSizes = themeJson.settings.typography.fontSizes;

        // Verify the order is correct (12px = 0.75rem, 16px = 1rem)
        expect(fontSizes.map((f: { size: string }) => f.size)).toEqual([
            '12px', // 0.75rem
            '16px', // 1rem
            '1em', // 1rem
            '1rem', // 1rem
            '1.5rem', // 1.5rem
        ]);
    });

    it('should not include text shadow variables as font sizes', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --text-shadow-xs: 0px 1px 1px #0003;
        --text-shadow-md: 0px 1px 2px #0000001a;
        --text-lg: 1.125rem;
        --text-base: 1rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);
        const fontSizes = themeJson.settings.typography.fontSizes;

        expect(fontSizes).toContainEqual({
            name: 'lg',
            slug: 'lg',
            size: '1.125rem',
        });

        expect(fontSizes).toContainEqual({
            name: 'base',
            slug: 'base',
            size: '1rem',
        });

        expect(
            fontSizes.some((f: { slug: string }) => f.slug.includes('shadow'))
        ).toBe(false);
    });

    it('should process border radius CSS variables from @theme block', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --radius-sm: 0.125rem;
        --radius-md: 0.375rem;
        --radius-lg: 0.5rem;
        --radius-full: 9999px;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.border.radius).toBe(true);
        expect(themeJson.settings.border.radiusSizes).toContainEqual({
            name: 'sm',
            slug: 'sm',
            size: '0.125rem',
        });
        expect(themeJson.settings.border.radiusSizes).toContainEqual({
            name: 'lg',
            slug: 'lg',
            size: '0.5rem',
        });
        expect(themeJson.settings.border.radiusSizes).toContainEqual({
            name: 'full',
            slug: 'full',
            size: '9999px',
        });
    });

    it('should sort border radius sizes from smallest to largest', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --radius-full: 9999px;
        --radius-sm: 0.125rem;
        --radius-lg: 0.5rem;
        --radius-md: 0.375rem;
        --radius-xs: 0.0625rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);
        const radiusSizes = themeJson.settings.border.radiusSizes;

        expect(
            radiusSizes.map((r: { size: string }) => r.size)
        ).toEqual([
            '0.0625rem', // xs
            '0.125rem',  // sm
            '0.375rem',  // md
            '0.5rem',    // lg
            '9999px',    // full
        ]);
    });

    it('should handle border radius labels', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
            borderRadiusLabels: {
                sm: 'Small',
                md: 'Medium',
                lg: 'Large',
                full: 'Full',
            },
        });

        const cssContent = `
      @theme {
        --radius-sm: 0.125rem;
        --radius-md: 0.375rem;
        --radius-lg: 0.5rem;
        --radius-full: 9999px;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.border.radiusSizes).toContainEqual({
            name: 'Small',
            slug: 'sm',
            size: '0.125rem',
        });
        expect(themeJson.settings.border.radiusSizes).toContainEqual({
            name: 'Full',
            slug: 'full',
            size: '9999px',
        });
    });

    it('should respect disableTailwindBorderRadius flag', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
            disableTailwindBorderRadius: true,
        });

        const cssContent = `
      @theme {
        --radius-sm: 0.125rem;
        --radius-lg: 0.5rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.border).toBeUndefined();
    });

    it('should deduplicate border radius entries with base theme.json', () => {
        const existingThemeJson = {
            settings: {
                border: {
                    radius: true,
                    radiusSizes: [
                        { name: 'Small', slug: 'sm', size: '0.125rem' },
                    ],
                },
                typography: {
                    fontFamilies: [],
                    fontSizes: [],
                },
            },
        };

        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify(existingThemeJson)
        );

        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --radius-sm: 0.25rem;
        --radius-lg: 0.5rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);
        const smEntries = themeJson.settings.border.radiusSizes.filter(
            (r: { slug: string }) => r.slug === 'sm'
        );

        // Base theme.json entry should win (dedup keeps first)
        expect(smEntries).toHaveLength(1);
        expect(smEntries[0].size).toBe('0.125rem');
    });

    it('should respect base theme.json border.radius: false', () => {
        const existingThemeJson = {
            settings: {
                border: {
                    radius: false,
                },
                typography: {
                    fontFamilies: [],
                    fontSizes: [],
                },
            },
        };

        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify(existingThemeJson)
        );

        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --radius-sm: 0.125rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.border.radius).toBe(false);
    });

    it('should filter out function-based radius values but keep multi-value', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --radius-sm: 0.125rem;
        --radius-dynamic: var(--custom-radius);
        --radius-clamped: clamp(0.5rem, 2vw, 1rem);
        --radius-pill: 15px 255px;
        --radius-lg: 0.5rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);
        const slugs = themeJson.settings.border.radiusSizes.map(
            (r: { slug: string }) => r.slug
        );

        expect(slugs).toContain('sm');
        expect(slugs).toContain('lg');
        expect(slugs).toContain('pill');
        expect(slugs).not.toContain('dynamic');
        expect(slugs).not.toContain('clamped');
    });

    it('should sort multi-value radii by first value and zero-value radii correctly', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --radius-lg: 0.5rem;
        --radius-none: 0px;
        --radius-pill: 15px 255px;
        --radius-sm: 0.125rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);
        const slugs = themeJson.settings.border.radiusSizes.map(
            (r: { slug: string }) => r.slug
        );

        // 0px should come first, then sm, lg, pill (sorted by first token)
        expect(slugs.indexOf('none')).toBe(0);
        expect(slugs.indexOf('sm')).toBeLessThan(slugs.indexOf('lg'));
        expect(slugs.indexOf('lg')).toBeLessThan(slugs.indexOf('pill'));
    });

    it('should preserve base border settings without adding radius when no entries exist', () => {
        const existingThemeJson = {
            settings: {
                border: {
                    color: true,
                    style: true,
                    width: true,
                },
                typography: {
                    fontFamilies: [],
                    fontSizes: [],
                },
            },
        };

        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify(existingThemeJson)
        );

        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --color-primary: #000000;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.border).toEqual({
            color: true,
            style: true,
            width: true,
        });
        expect(themeJson.settings.border.radius).toBeUndefined();
        expect(themeJson.settings.border.radiusSizes).toBeUndefined();
    });

    it('should not emit border settings when no radius entries exist', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --color-primary: #000000;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.border).toBeUndefined();
    });

    it('should process border radius from Tailwind config', async () => {
        const tailwindConfigWithRadius = {
            default: {
                theme: {
                    colors: { primary: '#000000' },
                    fontFamily: { sans: ['system-ui'] },
                    fontSize: { base: '1rem' },
                    borderRadius: {
                        sm: '0.125rem',
                        md: '0.375rem',
                        lg: '0.5rem',
                        full: '9999px',
                    },
                },
            },
        };

        // Mock dynamic import used by loadTailwindConfig
        vi.doMock(path.resolve(mockTailwindConfigPath), () => tailwindConfigWithRadius);

        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
            borderRadiusLabels: { full: 'Full' },
        });

        // Load Tailwind config via configResolved
        await (plugin.configResolved as any)?.();

        // No @theme block — radius should come from Tailwind config
        const cssContent = `.foo { color: red; }`;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.border.radiusSizes).toContainEqual({
            name: 'sm',
            slug: 'sm',
            size: '0.125rem',
        });
        expect(themeJson.settings.border.radiusSizes).toContainEqual({
            name: 'Full',
            slug: 'full',
            size: '9999px',
        });
    });

    it('should merge theme.extend.borderRadius from Tailwind config', async () => {
        const tailwindConfigWithExtend = {
            default: {
                theme: {
                    borderRadius: {
                        sm: '0.125rem',
                    },
                    extend: {
                        borderRadius: {
                            pill: '9999px',
                        },
                    },
                },
            },
        };

        vi.doMock(path.resolve(mockTailwindConfigPath), () => tailwindConfigWithExtend);

        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        await (plugin.configResolved as any)?.();

        const cssContent = `.foo { color: red; }`;
        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.border.radiusSizes).toContainEqual({
            name: 'sm',
            slug: 'sm',
            size: '0.125rem',
        });
        expect(themeJson.settings.border.radiusSizes).toContainEqual({
            name: 'pill',
            slug: 'pill',
            size: '9999px',
        });
    });

    it('should preserve existing base border settings when disableTailwindBorderRadius is true', () => {
        const existingThemeJson = {
            settings: {
                border: {
                    color: true,
                    style: true,
                    width: true,
                    radius: true,
                    radiusSizes: [
                        { name: 'Small', slug: 'sm', size: '0.25rem' },
                    ],
                },
                typography: {
                    fontFamilies: [],
                    fontSizes: [],
                },
            },
        };

        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify(existingThemeJson)
        );

        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
            disableTailwindBorderRadius: true,
        });

        const cssContent = `
      @theme {
        --radius-lg: 0.5rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        expect(themeJson.settings.border).toEqual(existingThemeJson.settings.border);
    });

    it('should sort unsupported units to the end', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --radius-sm: 0.125rem;
        --radius-relative: 50%;
        --radius-viewport: 5vh;
        --radius-lg: 0.5rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);
        const slugs = themeJson.settings.border.radiusSizes.map(
            (r: { slug: string }) => r.slug
        );

        // Parseable values first, unsupported units at end
        expect(slugs.indexOf('sm')).toBeLessThan(slugs.indexOf('relative'));
        expect(slugs.indexOf('lg')).toBeLessThan(slugs.indexOf('relative'));
        expect(slugs.indexOf('lg')).toBeLessThan(slugs.indexOf('viewport'));
    });

    it('should filter out wildcard namespace resets and CSS-wide keywords', () => {
        const plugin = wordpressThemeJson({
            tailwindConfig: mockTailwindConfigPath,
        });

        const cssContent = `
      @theme {
        --font-*: initial;
        --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
        --color-*: initial;
        --color-primary: #000000;
        --text-*: inherit;
        --text-lg: 1.125rem;
      }
    `;

        (plugin.transform as any)(cssContent, 'app.css');

        const emitFile = vi.fn();
        (plugin.generateBundle as any).call({ emitFile });

        const themeJson = JSON.parse(emitFile.mock.calls[0][0].source);

        // Font families should only contain sans, not wildcard
        const fontSlugs = themeJson.settings.typography.fontFamilies.map(
            (f: { slug: string }) => f.slug
        );
        expect(fontSlugs).toContain('sans');
        expect(fontSlugs).not.toContain('*');
        expect(fontSlugs).toHaveLength(1);

        // Colors should only contain primary, not wildcard
        const colorSlugs = themeJson.settings.color.palette.map(
            (c: { slug: string }) => c.slug
        );
        expect(colorSlugs).toContain('primary');
        expect(colorSlugs).toHaveLength(1);

        // Font sizes should only contain lg, not wildcard
        const sizeSlugs = themeJson.settings.typography.fontSizes.map(
            (s: { slug: string }) => s.slug
        );
        expect(sizeSlugs).toContain('lg');
        expect(sizeSlugs).toHaveLength(1);
    });
});
