/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, afterAll } from 'vitest';
import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { wordpressThemeJson } from '../src/index.js';
import fs from 'fs';
import path from 'path';

const fixtureDir = path.resolve(__dirname, 'fixture');
const outDir = path.join(fixtureDir, 'dist');

async function runBuild(pluginOptions = {}, baseThemeJson = 'theme.json') {
    await build({
        plugins: [
            tailwindcss(),
            wordpressThemeJson({
                baseThemeJsonPath: path.join(fixtureDir, baseThemeJson),
                outputPath: 'theme.json',
                ...pluginOptions,
            }),
        ],
        build: {
            rolldownOptions: {
                input: path.join(fixtureDir, 'app.css'),
            },
            outDir,
            emptyOutDir: true,
            write: true,
        },
        logLevel: 'silent',
    });

    return JSON.parse(fs.readFileSync(path.join(outDir, 'theme.json'), 'utf8'));
}

describe('vite build integration', () => {
    afterAll(() => {
        fs.rmSync(outDir, { recursive: true, force: true });
    });

    describe('colors', () => {
        it('should extract all 11 shades for each color family', async () => {
            const themeJson = await runBuild();
            const palette = themeJson.settings.color.palette;
            const expectedShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
            const redColors = palette.filter((c: any) => c.slug.startsWith('red-'));

            expect(redColors).toHaveLength(11);

            for (const shade of expectedShades) {
                expect(palette).toContainEqual(
                    expect.objectContaining({
                        name: `Red (${shade})`,
                        slug: `red-${shade}`,
                    })
                );
            }
        });

        it('should include all Tailwind color families', async () => {
            const themeJson = await runBuild();
            const palette = themeJson.settings.color.palette;
            const slugs = palette.map((c: any) => c.slug);
            const expectedFamilies = [
                'red', 'orange', 'amber', 'yellow', 'lime', 'green',
                'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo',
                'violet', 'purple', 'fuchsia', 'pink', 'rose',
                'slate', 'gray', 'zinc', 'neutral', 'stone',
            ];

            for (const family of expectedFamilies) {
                expect(slugs.some((s: string) => s.startsWith(`${family}-`))).toBe(true);
            }
        });

        it('should use oklch color format', async () => {
            const themeJson = await runBuild();
            const palette = themeJson.settings.color.palette;
            const colorsWithShades = palette.filter((c: any) => c.slug.includes('-'));

            for (const color of colorsWithShades) {
                expect(color.color).toMatch(/^oklch\(/);
            }
        });

        it('should not include colors when disabled', async () => {
            const themeJson = await runBuild({ disableTailwindColors: true });

            expect(themeJson.settings.color.palette).toBeUndefined();
        });
    });

    describe('fonts', () => {
        it('should extract all default font families', async () => {
            const themeJson = await runBuild();
            const fonts = themeJson.settings.typography.fontFamilies;

            expect(fonts).toHaveLength(3);
            expect(fonts).toContainEqual(
                expect.objectContaining({ slug: 'sans' })
            );
            expect(fonts).toContainEqual(
                expect.objectContaining({ slug: 'serif' })
            );
            expect(fonts).toContainEqual(
                expect.objectContaining({ slug: 'mono' })
            );
        });

        it('should include full fontFamily values', async () => {
            const themeJson = await runBuild();
            const fonts = themeJson.settings.typography.fontFamilies;
            const sans = fonts.find((f: any) => f.slug === 'sans');

            expect(sans.fontFamily).toContain('sans-serif');
        });

        it('should not include fonts when disabled', async () => {
            const themeJson = await runBuild({ disableTailwindFonts: true });

            expect(themeJson.settings.typography.fontFamilies).toBeUndefined();
        });
    });

    describe('font sizes', () => {
        it('should extract all 13 font sizes', async () => {
            const themeJson = await runBuild();
            const sizes = themeJson.settings.typography.fontSizes;

            expect(sizes).toHaveLength(13);

            const expectedSizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'];

            for (const size of expectedSizes) {
                expect(sizes).toContainEqual(
                    expect.objectContaining({ slug: size })
                );
            }
        });

        it('should sort font sizes from smallest to largest', async () => {
            const themeJson = await runBuild();
            const sizes = themeJson.settings.typography.fontSizes;
            const remValues = sizes.map((s: any) => parseFloat(s.size));

            for (let i = 1; i < remValues.length; i++) {
                expect(remValues[i]).toBeGreaterThanOrEqual(remValues[i - 1]);
            }
        });

        it('should not include font sizes when disabled', async () => {
            const themeJson = await runBuild({ disableTailwindFontSizes: true });

            expect(themeJson.settings.typography.fontSizes).toBeUndefined();
        });
    });

    describe('border radius', () => {
        it('should extract all 8 border radius sizes', async () => {
            const themeJson = await runBuild({ disableTailwindBorderRadius: false });
            const radiusSizes = themeJson.settings.border?.radiusSizes;

            expect(radiusSizes).toHaveLength(8);

            const expectedSlugs = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];

            for (const slug of expectedSlugs) {
                expect(radiusSizes).toContainEqual(
                    expect.objectContaining({ slug })
                );
            }
        });

        it('should sort border radius sizes from smallest to largest', async () => {
            const themeJson = await runBuild({ disableTailwindBorderRadius: false });
            const radiusSizes = themeJson.settings.border?.radiusSizes;
            const remValues = radiusSizes!.map((s: any) => parseFloat(s.size));

            for (let i = 1; i < remValues.length; i++) {
                expect(remValues[i]).toBeGreaterThanOrEqual(remValues[i - 1]);
            }
        });

        it('should not include border radius when disabled', async () => {
            const themeJson = await runBuild({ disableTailwindBorderRadius: true });

            expect(themeJson.settings.border?.radiusSizes).toBeUndefined();
        });
    });

    describe('base theme.json', () => {
        it('should preserve settings from base theme.json', async () => {
            const themeJson = await runBuild();

            expect(themeJson.settings.color.custom).toBe(false);
            expect(themeJson.settings.color.defaultPalette).toBe(false);
            expect(themeJson.settings.typography.defaultFontSizes).toBe(false);
            expect(themeJson.settings.typography.customFontSize).toBe(false);
        });

        it('should include the __processed__ marker', async () => {
            const themeJson = await runBuild();

            expect(themeJson.__processed__).toBe('This file was generated using Vite');
        });

        it('should remove __preprocessed__ marker from base', async () => {
            const themeJson = await runBuild({}, 'theme-with-base.json');

            expect(themeJson.__preprocessed__).toBeUndefined();
            expect(themeJson.__processed__).toBe('This file was generated using Vite');
        });
    });

    describe('base theme.json with existing values', () => {
        it('should preserve base palette when colors are disabled', async () => {
            const themeJson = await runBuild(
                { disableTailwindColors: true },
                'theme-with-base.json'
            );
            const palette = themeJson.settings.color.palette;

            expect(palette).toHaveLength(2);
            expect(palette).toContainEqual(
                expect.objectContaining({ slug: 'brand', color: '#ff6600' })
            );
        });

        it('should preserve base fontFamilies when fonts are disabled', async () => {
            const themeJson = await runBuild(
                { disableTailwindFonts: true },
                'theme-with-base.json'
            );
            const fonts = themeJson.settings.typography.fontFamilies;

            expect(fonts).toHaveLength(2);
            expect(fonts).toContainEqual(
                expect.objectContaining({ slug: 'brand' })
            );
            expect(fonts).toContainEqual(
                expect.objectContaining({ slug: 'sans', fontFamily: 'CustomSans, sans-serif' })
            );
        });

        it('should preserve base fontSizes when font sizes are disabled', async () => {
            const themeJson = await runBuild(
                { disableTailwindFontSizes: true },
                'theme-with-base.json'
            );
            const sizes = themeJson.settings.typography.fontSizes;

            expect(sizes).toHaveLength(2);
            expect(sizes).toContainEqual(
                expect.objectContaining({ slug: 'tiny', size: '.5rem' })
            );
            expect(sizes).toContainEqual(
                expect.objectContaining({ slug: 'xl', size: '99rem' })
            );
        });

        it('should preserve base radiusSizes when border radius is disabled', async () => {
            const themeJson = await runBuild(
                { disableTailwindBorderRadius: true },
                'theme-with-base.json'
            );
            const radiusSizes = themeJson.settings.border?.radiusSizes;

            expect(radiusSizes).toHaveLength(2);
            expect(radiusSizes).toContainEqual(
                expect.objectContaining({ slug: 'pill', size: '9999px' })
            );
            expect(radiusSizes).toContainEqual(
                expect.objectContaining({ slug: 'xl', size: '99rem' })
            );
        });

        it('should include base custom colors alongside generated ones', async () => {
            const themeJson = await runBuild({}, 'theme-with-base.json');
            const palette = themeJson.settings.color.palette;

            expect(palette).toContainEqual(
                expect.objectContaining({ slug: 'brand', color: '#ff6600' })
            );
            expect(palette.some((c: any) => c.slug.startsWith('blue-'))).toBe(true);
        });

        it('should dedupe colors by slug with base values winning', async () => {
            const themeJson = await runBuild({}, 'theme-with-base.json');
            const palette = themeJson.settings.color.palette;
            const red500 = palette.filter((c: any) => c.slug === 'red-500');

            expect(red500).toHaveLength(1);
            expect(red500[0].color).toBe('#custom-red');
        });

        it('should dedupe fontFamilies by slug with base values winning', async () => {
            const themeJson = await runBuild({}, 'theme-with-base.json');
            const fonts = themeJson.settings.typography.fontFamilies;
            const sans = fonts.filter((f: any) => f.slug === 'sans');

            expect(sans).toHaveLength(1);
            expect(sans[0].fontFamily).toBe('CustomSans, sans-serif');
        });

        it('should dedupe fontSizes by slug with base values winning', async () => {
            const themeJson = await runBuild({}, 'theme-with-base.json');
            const sizes = themeJson.settings.typography.fontSizes;
            const xl = sizes.filter((s: any) => s.slug === 'xl');

            expect(xl).toHaveLength(1);
            expect(xl[0].size).toBe('99rem');
        });

        it('should dedupe radiusSizes by slug with base values winning', async () => {
            const themeJson = await runBuild(
                { disableTailwindBorderRadius: false },
                'theme-with-base.json'
            );
            const radiusSizes = themeJson.settings.border?.radiusSizes;
            const xl = radiusSizes!.filter((r: any) => r.slug === 'xl');

            expect(xl).toHaveLength(1);
            expect(xl[0].size).toBe('99rem');
        });
    });

    describe('label customization', () => {
        it('should apply shadeLabels to color names', async () => {
            const themeJson = await runBuild({
                shadeLabels: { '500': 'Default' },
            });
            const palette = themeJson.settings.color.palette;

            expect(palette).toContainEqual(
                expect.objectContaining({
                    slug: 'red-500',
                    name: 'Default Red',
                })
            );
        });

        it('should apply fontLabels to font family names', async () => {
            const themeJson = await runBuild({
                fontLabels: { sans: 'System Sans' },
            });
            const fonts = themeJson.settings.typography.fontFamilies;

            expect(fonts).toContainEqual(
                expect.objectContaining({
                    slug: 'sans',
                    name: 'System Sans',
                })
            );
        });

        it('should apply fontSizeLabels to font size names', async () => {
            const themeJson = await runBuild({
                fontSizeLabels: { xl: 'Extra Large' },
            });
            const sizes = themeJson.settings.typography.fontSizes;

            expect(sizes).toContainEqual(
                expect.objectContaining({
                    slug: 'xl',
                    name: 'Extra Large',
                })
            );
        });

        it('should apply borderRadiusLabels to radius names', async () => {
            const themeJson = await runBuild({
                disableTailwindBorderRadius: false,
                borderRadiusLabels: { xl: 'Extra Large' },
            });
            const radiusSizes = themeJson.settings.border?.radiusSizes;

            expect(radiusSizes).toContainEqual(
                expect.objectContaining({
                    slug: 'xl',
                    name: 'Extra Large',
                })
            );
        });
    });
});
