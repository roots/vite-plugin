import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { deepMerge, findPartialFiles, mergePartials } from "../src/theme/partials.js";
import type { ThemeJson } from "../src/types.js";

describe("deepMerge", () => {
    it("should merge flat objects", () => {
        const target = { a: 1, b: 2 };
        const source = { b: 3, c: 4 };

        deepMerge(target, source);

        expect(target).toEqual({ a: 1, b: 3, c: 4 });
    });

    it("should recursively merge nested objects", () => {
        const target = { a: { x: 1, y: 2 }, b: 1 };
        const source = { a: { y: 3, z: 4 } };

        deepMerge(target, source);

        expect(target).toEqual({ a: { x: 1, y: 3, z: 4 }, b: 1 });
    });

    it("should overwrite arrays instead of merging", () => {
        const target = { a: [1, 2] };
        const source = { a: [3, 4, 5] };

        deepMerge(target, source);

        expect(target).toEqual({ a: [3, 4, 5] });
    });

    it("should overwrite primitives with objects", () => {
        const target = { a: "string" } as Record<string, unknown>;
        const source = { a: { nested: true } };

        deepMerge(target, source);

        expect(target).toEqual({ a: { nested: true } });
    });

    it("should handle deeply nested structures", () => {
        const target = {
            styles: {
                blocks: {
                    "core/paragraph": { spacing: { margin: { top: "1rem" } } },
                },
            },
        };

        const source = {
            styles: {
                blocks: {
                    "core/paragraph": { spacing: { margin: { bottom: "2rem" } } },
                    "core/heading": { typography: { fontWeight: "600" } },
                },
            },
        };

        deepMerge(target, source);

        expect(target.styles.blocks["core/paragraph"].spacing.margin).toEqual({
            top: "1rem",
            bottom: "2rem",
        });

        expect((target.styles.blocks as Record<string, unknown>)["core/heading"]).toEqual({
            typography: { fontWeight: "600" },
        });
    });
});

describe("findPartialFiles", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "partials-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("should find .theme.js files", () => {
        fs.writeFileSync(path.join(tmpDir, "button.theme.js"), "export default {}");

        const files = findPartialFiles(tmpDir);

        expect(files).toHaveLength(1);
        expect(files[0]).toContain("button.theme.js");
    });

    it("should not find .theme.json files", () => {
        fs.writeFileSync(path.join(tmpDir, "global.theme.json"), "{}");

        const files = findPartialFiles(tmpDir);

        expect(files).toHaveLength(0);
    });

    it("should find files in subdirectories", () => {
        const sub = path.join(tmpDir, "blocks");
        fs.mkdirSync(sub);
        fs.writeFileSync(path.join(sub, "button.theme.js"), "export default {}");

        const files = findPartialFiles(tmpDir);

        expect(files).toHaveLength(1);
    });

    it("should ignore node_modules", () => {
        const nm = path.join(tmpDir, "node_modules", "pkg");
        fs.mkdirSync(nm, { recursive: true });
        fs.writeFileSync(path.join(nm, "something.theme.js"), "export default {}");
        fs.writeFileSync(path.join(tmpDir, "button.theme.js"), "export default {}");

        const files = findPartialFiles(tmpDir);

        expect(files).toHaveLength(1);
        expect(files[0]).toContain("button.theme.js");
    });

    it("should ignore vendor, dist, and public directories", () => {
        for (const dir of ["vendor", "dist", "public"]) {
            const d = path.join(tmpDir, dir);
            fs.mkdirSync(d);
            fs.writeFileSync(path.join(d, "test.theme.js"), "export default {}");
        }

        const files = findPartialFiles(tmpDir);

        expect(files).toHaveLength(0);
    });

    it("should not match non-theme files", () => {
        fs.writeFileSync(path.join(tmpDir, "app.js"), "export default {}");
        fs.writeFileSync(path.join(tmpDir, "theme.js"), "export default {}");
        fs.writeFileSync(path.join(tmpDir, "config.json"), "{}");

        const files = findPartialFiles(tmpDir);

        expect(files).toHaveLength(0);
    });

    it("should return files sorted alphabetically", () => {
        fs.writeFileSync(path.join(tmpDir, "c.theme.js"), "export default {}");
        fs.writeFileSync(path.join(tmpDir, "a.theme.js"), "export default {}");
        fs.writeFileSync(path.join(tmpDir, "b.theme.js"), "export default {}");

        const files = findPartialFiles(tmpDir);

        expect(files.map((f) => path.basename(f))).toEqual([
            "a.theme.js",
            "b.theme.js",
            "c.theme.js",
        ]);
    });
});

describe("mergePartials", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "partials-merge-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("should merge shorthand blocks/elements into styles", async () => {
        fs.writeFileSync(
            path.join(tmpDir, "global.theme.js"),
            `export default ${JSON.stringify({
                blocks: {
                    "core/paragraph": { spacing: { margin: { bottom: "1rem" } } },
                },
                elements: {
                    h1: { typography: { fontSize: "2rem" } },
                },
            })}`,
        );

        const themeJson = {
            settings: { typography: { defaultFontSizes: false, customFontSize: false } },
        } as ThemeJson;

        await mergePartials(themeJson, findPartialFiles(tmpDir));

        const result = themeJson as unknown as Record<string, unknown>;
        const styles = result.styles as Record<string, unknown>;

        expect(styles.blocks).toEqual({
            "core/paragraph": { spacing: { margin: { bottom: "1rem" } } },
        });

        expect(styles.elements).toEqual({
            h1: { typography: { fontSize: "2rem" } },
        });
    });

    it("should merge full styles export at root", async () => {
        fs.writeFileSync(
            path.join(tmpDir, "button.theme.js"),
            `export default ${JSON.stringify({
                styles: {
                    blocks: {
                        "core/button": { border: { radius: "0" } },
                    },
                },
            })}`,
        );

        const themeJson = {
            settings: { typography: { defaultFontSizes: false, customFontSize: false } },
        } as ThemeJson;

        await mergePartials(themeJson, findPartialFiles(tmpDir));

        const result = themeJson as unknown as Record<string, unknown>;
        const styles = result.styles as Record<string, unknown>;
        const blocks = styles.blocks as Record<string, unknown>;

        expect(blocks["core/button"]).toEqual({ border: { radius: "0" } });
    });

    it("should deep merge multiple partials", async () => {
        fs.writeFileSync(
            path.join(tmpDir, "a.theme.js"),
            `export default ${JSON.stringify({
                blocks: {
                    "core/paragraph": { spacing: { margin: { bottom: "1rem" } } },
                },
            })}`,
        );

        fs.writeFileSync(
            path.join(tmpDir, "b.theme.js"),
            `export default ${JSON.stringify({
                blocks: {
                    "core/paragraph": { spacing: { padding: { left: "0.5rem" } } },
                    "core/heading": { typography: { fontWeight: "600" } },
                },
            })}`,
        );

        const themeJson = {
            settings: { typography: { defaultFontSizes: false, customFontSize: false } },
        } as ThemeJson;

        await mergePartials(themeJson, findPartialFiles(tmpDir));

        const styles = (themeJson as unknown as Record<string, unknown>).styles as Record<
            string,
            unknown
        >;
        const blocks = styles.blocks as Record<string, Record<string, unknown>>;

        expect(blocks["core/paragraph"]).toEqual({
            spacing: {
                margin: { bottom: "1rem" },
                padding: { left: "0.5rem" },
            },
        });

        expect(blocks["core/heading"]).toEqual({
            typography: { fontWeight: "600" },
        });
    });

    it("should handle no partial files gracefully", async () => {
        const themeJson = {
            settings: { typography: { defaultFontSizes: false, customFontSize: false } },
        } as ThemeJson;

        await mergePartials(themeJson, []);

        expect((themeJson as unknown as Record<string, unknown>).styles).toBeUndefined();
    });
});
