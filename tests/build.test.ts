import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { wordpressThemeJson } from '../src/index.js';
import fs from 'fs';
import path from 'path';

const fixtureDir = path.resolve(__dirname, 'fixture');
const outDir = path.join(fixtureDir, 'dist');

async function runBuild(pluginOptions = {}) {
    await build({
        plugins: [
            tailwindcss(),
            wordpressThemeJson({
                baseThemeJsonPath: path.join(fixtureDir, 'theme.json'),
                outputPath: 'theme.json',
                ...pluginOptions,
            }),
        ],
        build: {
            rollupOptions: {
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
        it('should extract all 11 shades for each color', async () => {
            const themeJson = await runBuild();
            const palette = themeJson.settings.color.palette;

            const redColors = palette.filter((c: any) => c.slug.startsWith('red-'));
            expect(redColors).toHaveLength(11);

            const expectedShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
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

        it('should not include colors when disabled', async () => {
            const themeJson = await runBuild({ disableTailwindColors: true });
            expect(themeJson.settings.color.palette).toBeUndefined();
        });
    });

    describe('fonts', () => {
        it('should extract font families', async () => {
            const themeJson = await runBuild();
            const fonts = themeJson.settings.typography.fontFamilies;

            expect(fonts).toContainEqual(
                expect.objectContaining({ slug: 'sans' })
            );
            expect(fonts).toContainEqual(
                expect.objectContaining({ slug: 'mono' })
            );
        });
    });

    describe('font sizes', () => {
        it('should extract all font sizes', async () => {
            const themeJson = await runBuild();
            const sizes = themeJson.settings.typography.fontSizes;

            const expectedSizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'];
            for (const size of expectedSizes) {
                expect(sizes).toContainEqual(
                    expect.objectContaining({ slug: size })
                );
            }
        });
    });

    describe('border radius', () => {
        it('should extract border radius sizes', async () => {
            const themeJson = await runBuild({ disableTailwindBorderRadius: false });
            const radiusSizes = themeJson.settings.border?.radiusSizes;

            expect(radiusSizes).toBeDefined();
            expect(radiusSizes!.length).toBeGreaterThan(0);
        });
    });
});
