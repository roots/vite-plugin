import type { Plugin as VitePlugin, ResolvedConfig } from "vite";
import fs from "fs";
import path from "path";
import type { ThemeJsonConfig, ThemeJson, TailwindConfig } from "../types.js";
import { CSS_VARIABLE_PATTERNS } from "../constants.js";
import { extractThemeContent, extractVariables } from "./css-parser.js";
import { loadTailwindConfig } from "./tailwind.js";
import { resolveColors } from "./colors.js";
import { resolveFonts } from "./fonts.js";
import { resolveFontSizes } from "./font-sizes.js";
import { resolveBorderRadii } from "./border-radius.js";
import { buildSettings } from "./settings.js";
import { mergePartials, findPartialFiles, resolvePartialDirs } from "./partials.js";

/**
 * Generate a WordPress theme.json from Tailwind CSS
 * design tokens and @theme block variables.
 */
export function wordpressThemeJson(config: ThemeJsonConfig = {}): VitePlugin {
    const {
        tailwindConfig,
        disableTailwindColors = false,
        disableTailwindFonts = false,
        disableTailwindFontSizes = false,
        disableTailwindBorderRadius = false,
        baseThemeJsonPath = "./theme.json",
        outputPath = "assets/theme.json",
        cssFile = "app.css",
        partials: partialsOption = "resources",
        shadeLabels,
        fontLabels,
        fontSizeLabels,
        borderRadiusLabels,
    } = config;

    let cssContent: string | null = null;
    let resolvedTailwindConfig: TailwindConfig | undefined;
    let rootDir: string = process.cwd();

    if (tailwindConfig !== undefined && typeof tailwindConfig !== "string") {
        throw new Error("tailwindConfig must be a string path or undefined");
    }

    return {
        name: "wordpress-theme-json",
        enforce: "pre",

        async configResolved(resolvedConfig: ResolvedConfig) {
            rootDir = resolvedConfig?.root ?? process.cwd();

            if (tailwindConfig) {
                resolvedTailwindConfig = await loadTailwindConfig(tailwindConfig);
            }

            if (partialsOption !== false && resolvedConfig?.command === "serve") {
                const partialDirs = resolvePartialDirs(partialsOption, rootDir);
                const files = partialDirs.flatMap(findPartialFiles);

                for (const file of files) {
                    resolvedConfig.configFileDependencies.push(file);
                }
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
                    fs.readFileSync(path.resolve(baseThemeJsonPath), "utf8"),
                ) as ThemeJson;

                const themeContent = cssContent ? extractThemeContent(cssContent) : null;

                const theme = resolvedTailwindConfig?.theme;

                // Extract CSS variables from @theme block
                const colorVars = extractVariables(CSS_VARIABLE_PATTERNS.COLOR, themeContent);
                const fontVars = extractVariables(CSS_VARIABLE_PATTERNS.FONT_FAMILY, themeContent);
                const fontSizeVars = extractVariables(
                    CSS_VARIABLE_PATTERNS.FONT_SIZE,
                    themeContent,
                );
                const borderRadiusVars = extractVariables(
                    CSS_VARIABLE_PATTERNS.BORDER_RADIUS,
                    themeContent,
                );

                // Resolve entries from both sources
                const colors = !disableTailwindColors
                    ? resolveColors(colorVars, theme?.colors, shadeLabels)
                    : undefined;

                const fonts = !disableTailwindFonts
                    ? resolveFonts(fontVars, theme?.fontFamily, fontLabels)
                    : undefined;

                const fontSizes = !disableTailwindFontSizes
                    ? resolveFontSizes(fontSizeVars, theme?.fontSize, fontSizeLabels)
                    : undefined;

                const borderRadii = !disableTailwindBorderRadius
                    ? resolveBorderRadii(borderRadiusVars, theme?.borderRadius, borderRadiusLabels)
                    : undefined;

                // Build theme.json
                const themeJson: ThemeJson = {
                    __processed__: "This file was generated using Vite",
                    ...baseThemeJson,
                    settings: buildSettings({
                        baseSettings: baseThemeJson.settings,
                        colors,
                        fonts,
                        fontSizes,
                        borderRadii,
                        disabled: {
                            colors: disableTailwindColors,
                            fonts: disableTailwindFonts,
                            fontSizes: disableTailwindFontSizes,
                            borderRadius: disableTailwindBorderRadius,
                        },
                    }),
                };

                delete themeJson.__preprocessed__;

                // Merge partials
                if (partialsOption !== false) {
                    const partialDirs = resolvePartialDirs(partialsOption, rootDir);
                    const partialFiles = partialDirs.flatMap(findPartialFiles);

                    if (partialFiles.length > 0) {
                        await mergePartials(themeJson, partialFiles);
                    }
                }

                this.emitFile({
                    type: "asset",
                    fileName: outputPath,
                    source: JSON.stringify(themeJson, null, 2),
                });
            } catch (error) {
                throw error instanceof Error ? error : new Error(String(error));
            }
        },
    };
}
