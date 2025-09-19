/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { wordpressPlugin, wordpressThemeJson } from '../src/index.js';
import type { Plugin, TransformResult } from 'vite';
import type { InputOptions } from 'rollup';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('path');

describe('wordpressPlugin', () => {
    let plugin: Plugin;

    beforeEach(() => {
        plugin = wordpressPlugin();
    });

    describe('import transformation', () => {
        it('should transform named imports', () => {
            const code = `import { useState, useEffect } from '@wordpress/element';`;
            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain(
                'const useState = wp.element.useState;'
            );
            expect(result?.code).toContain(
                'const useEffect = wp.element.useEffect;'
            );
        });

        it('should transform aliased named imports', () => {
            const code = `import { useState as useStateWP } from '@wordpress/element';`;
            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain(
                'const useStateWP = wp.element.useState;'
            );
        });

        it('should transform namespace imports', () => {
            const code = `import * as element from '@wordpress/element';`;
            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain('const element = wp.element;');
        });

        it('should transform default imports', () => {
            const code = `import apiFetch from '@wordpress/api-fetch';`;
            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain('const apiFetch = wp.apiFetch;');
        });

        it('should transform side-effect imports', () => {
            const code = `import '@wordpress/block-editor';`;
            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toBe('');
        });

        it('should handle multiple imports', () => {
            const code = `
            import { useState } from '@wordpress/element';
            import apiFetch from '@wordpress/api-fetch';
            import * as blocks from '@wordpress/blocks';
          `.trim();
            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain(
                'const useState = wp.element.useState;'
            );
            expect(result?.code).toContain('const apiFetch = wp.apiFetch;');
            expect(result?.code).toContain('const blocks = wp.blocks;');
        });

        it('should only transform files with supported extensions', () => {
            const code = `import { useState } from '@wordpress/element';`;
            const result = (plugin.transform as any)?.(code, 'test.md');

            expect(result).toBeNull();
        });

        it('should preserve non-WordPress imports', () => {
            const code = `
            import { useState } from '@wordpress/element';
            import React from 'react';
            import styles from './styles.css';
          `.trim();
            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain(
                'const useState = wp.element.useState;'
            );
            expect(result?.code).toContain("import React from 'react';");
            expect(result?.code).toContain(
                "import styles from './styles.css';"
            );
        });
    });

    describe('dependency tracking', () => {
        it('should track WordPress dependencies and generate manifest', () => {
            const code = `
            import { useState } from '@wordpress/element';
            import apiFetch from '@wordpress/api-fetch';
          `.trim();

            // Transform to trigger dependency tracking
            (plugin.transform as any)?.(code, 'test.tsx');

            // Mock emitFile to capture dependencies
            const emitFile = vi.fn();
            if (
                plugin.generateBundle &&
                typeof plugin.generateBundle === 'function'
            ) {
                const context = {
                    emitFile,
                    meta: {},
                    /* eslint-disable @typescript-eslint/no-unused-vars */
                    warn: (_message: string) => {
                        /* intentionally empty for tests */
                    },
                    error: (_message: string) => {
                        /* intentionally empty for tests */
                    },
                    /* eslint-enable @typescript-eslint/no-unused-vars */
                };

                plugin.generateBundle.call(
                    context as any,
                    {} as any,
                    {},
                    false
                );
            }

            expect(emitFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'editor.deps.json',
                    originalFileName: 'editor.deps.json',
                    type: 'asset',
                    source: JSON.stringify(
                        ['wp-element', 'wp-api-fetch'],
                        null,
                        2
                    ),
                })
            );
        });
    });

    describe('external handling', () => {
        it('should mark WordPress packages as external', () => {
            const result = (plugin.options as any)({
                input: 'src/index.ts',
            }) as InputOptions;

            const external = result.external as (id: string) => boolean;

            expect(external('@wordpress/element')).toBe(true);
            expect(external('@wordpress/components')).toBe(true);
            expect(external('@wordpress/blocks')).toBe(true);
        });

        it('should not mark non-WordPress packages as external', () => {
            const result = (plugin.options as any)({
                input: 'src/index.ts',
            }) as InputOptions;

            const external = result.external as (id: string) => boolean;

            expect(external('react')).toBe(false);
            expect(external('@emotion/react')).toBe(false);
            expect(external('./local-file')).toBe(false);
        });

        it('should handle non-string input IDs in external check', () => {
            const result = (plugin.options as any)({
                input: 'src/index.ts',
            }) as InputOptions;
            const external = result.external as (id: unknown) => boolean;

            expect(external(null)).toBe(false);
            expect(external(undefined)).toBe(false);
            expect(external(123)).toBe(false);
        });

        it('should preserve existing options while adding external handling', () => {
            const result = (plugin.options as any)({
                input: 'src/index.ts',
                treeshake: true,
                preserveEntrySignatures: 'strict' as const,
            }) as InputOptions;

            expect(result).toEqual(
                expect.objectContaining({
                    input: 'src/index.ts',
                    treeshake: true,
                    preserveEntrySignatures: 'strict',
                    external: expect.any(Function),
                })
            );
        });

        it('should not mark exempted WordPress packages as external', () => {
            const result = (plugin.options as any)({
                input: 'src/index.ts',
            }) as InputOptions;

            const external = result.external as (id: string) => boolean;

            expect(external('@wordpress/icons')).toBe(false);
            expect(external('@wordpress/dataviews')).toBe(false);
        });
    });
});

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

    it('should handle missing @theme block', () => {
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

        expect(emitFile).not.toHaveBeenCalled();
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
});
