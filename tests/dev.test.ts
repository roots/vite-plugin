/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, afterAll, afterEach, beforeEach } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { wordpressThemeJson } from '../src/index.js';
import fs from 'fs';
import path from 'path';

const fixtureDir = path.resolve(__dirname, 'fixture');
const outDir = path.join(fixtureDir, 'dist-dev');
const themeJsonPath = path.join(outDir, 'theme.json');

/**
 * Wait for theme.json to appear, contain a given marker, and stabilize
 * (no further writes for 250ms). This ensures debounced writes from the
 * startup transformRequest have completed before we assert.
 */
async function waitForThemeJson(
    marker?: string,
    timeout = 5000
): Promise<any> {
    const start = Date.now();
    let lastContent = '';
    let stableSince = 0;

    while (Date.now() - start < timeout) {
        if (fs.existsSync(themeJsonPath)) {
            const content = fs.readFileSync(themeJsonPath, 'utf8');
            try {
                const json = JSON.parse(content);
                if (!marker || content.includes(marker)) {
                    // Wait for the file to stop changing
                    if (content === lastContent) {
                        if (Date.now() - stableSince >= 250) return json;
                    } else {
                        lastContent = content;
                        stableSince = Date.now();
                    }
                }
            } catch {
                // partial write — retry
            }
        }
        await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(
        `theme.json did not stabilize${marker ? ` with marker "${marker}"` : ''} within ${timeout}ms`
    );
}

async function createDevServer(pluginOptions = {}, baseThemeJson = 'theme.json') {
    const server = await createServer({
        plugins: [
            tailwindcss(),
            wordpressThemeJson({
                baseThemeJsonPath: path.join(fixtureDir, baseThemeJson),
                outputPath: 'theme.json',
                ...pluginOptions,
            }),
        ],
        build: {
            rollupOptions: {
                input: path.join(fixtureDir, 'app.css'),
            },
            outDir,
        },
        server: {
            // Use a random port to avoid conflicts
            port: 0,
            strictPort: false,
        },
        logLevel: 'silent',
    });

    return server;
}

describe('vite dev integration', () => {
    let server: ViteDevServer | null = null;

    beforeEach(() => {
        fs.rmSync(outDir, { recursive: true, force: true });
    });

    afterEach(async () => {
        if (server) {
            await server.close();
            server = null;
        }
    });

    afterAll(() => {
        fs.rmSync(outDir, { recursive: true, force: true });
    });

    it('should generate theme.json on server start', async () => {
        server = await createDevServer();
        await server.listen();

        const themeJson = await waitForThemeJson('__processed__');

        expect(themeJson.__processed__).toBe(
            'This file was generated using Vite'
        );
        expect(themeJson.settings).toBeDefined();
    });

    it('should generate valid JSON (atomic write)', async () => {
        server = await createDevServer();
        await server.listen();

        const themeJson = await waitForThemeJson('__processed__');

        // Should be parseable — if atomic write failed we'd get a parse error
        expect(themeJson.__processed__).toBe(
            'This file was generated using Vite'
        );
        expect(typeof themeJson.settings).toBe('object');
    });

    it('should preserve base theme.json settings', async () => {
        server = await createDevServer();
        await server.listen();

        const themeJson = await waitForThemeJson('__processed__');

        // Base theme.json has custom: false and defaultPalette: false
        expect(themeJson.settings.color.custom).toBe(false);
        expect(themeJson.settings.color.defaultPalette).toBe(false);
    });

    it('should respect disableTailwindColors in dev mode', async () => {
        server = await createDevServer({ disableTailwindColors: true });
        await server.listen();

        const themeJson = await waitForThemeJson('__processed__');

        // When colors are disabled, palette should come from base only
        expect(themeJson.settings.color.custom).toBe(false);
        expect(themeJson.settings.color.palette).toBeUndefined();
    });

    it('should respect disableTailwindFonts in dev mode', async () => {
        server = await createDevServer({ disableTailwindFonts: true });
        await server.listen();

        const themeJson = await waitForThemeJson('__processed__');

        expect(themeJson.settings.typography.fontFamilies).toBeUndefined();
    });

    it('should respect disableTailwindFontSizes in dev mode', async () => {
        server = await createDevServer({ disableTailwindFontSizes: true });
        await server.listen();

        const themeJson = await waitForThemeJson('__processed__');

        expect(themeJson.settings.typography.fontSizes).toBeUndefined();
    });

    it('should respect disableTailwindBorderRadius in dev mode', async () => {
        server = await createDevServer({ disableTailwindBorderRadius: true });
        await server.listen();

        const themeJson = await waitForThemeJson('__processed__');

        expect(themeJson.settings.border).toBeUndefined();
    });

    it('should generate theme.json with CSS tokens after transform', async () => {
        server = await createDevServer();
        await server.listen();

        // Trigger a CSS transform by processing the module.
        await server.transformRequest(path.join(fixtureDir, 'app.css'));

        // Wait for debounced write — look for a color slug in the output
        const themeJson = await waitForThemeJson('red-50', 8000);

        expect(themeJson.__processed__).toBe(
            'This file was generated using Vite'
        );

        // Verify Tailwind color tokens were extracted from the dev CSS
        const palette = themeJson.settings.color.palette;
        expect(palette.length).toBeGreaterThan(0);
        expect(palette.some((c: any) => c.slug.startsWith('red-'))).toBe(true);
    }, 15000);

    it('should extract all token types from dev CSS', async () => {
        server = await createDevServer();
        await server.listen();

        await server.transformRequest(path.join(fixtureDir, 'app.css'));

        const themeJson = await waitForThemeJson('red-50', 8000);

        // Colors
        const palette = themeJson.settings.color.palette;
        expect(palette.length).toBeGreaterThan(0);

        // Font families
        const fonts = themeJson.settings.typography.fontFamilies;
        expect(fonts.length).toBeGreaterThan(0);

        // Font sizes
        const sizes = themeJson.settings.typography.fontSizes;
        expect(sizes.length).toBeGreaterThan(0);

        // Border radius
        const radius = themeJson.settings.border?.radiusSizes;
        expect(radius).toBeDefined();
        expect(radius.length).toBeGreaterThan(0);
    }, 15000);
});
