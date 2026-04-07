import fs from "fs";
import path from "path";
import type { ThemeJson } from "../types.js";

const IGNORE_DIRS = new Set(["node_modules", "vendor", "dist", "public"]);

/**
 * Deep merge source into target, mutating target.
 * Objects are recursively merged; arrays and primitives are overwritten.
 */
export function deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
): Record<string, unknown> {
    for (const key in source) {
        const val = source[key];

        if (val && typeof val === "object" && !Array.isArray(val)) {
            if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
                target[key] = {};
            }

            deepMerge(target[key] as Record<string, unknown>, val as Record<string, unknown>);
            continue;
        }

        target[key] = val;
    }

    return target;
}

/**
 * Resolve partial directory paths relative to the project root.
 */
export function resolvePartialDirs(partials: string | string[], rootDir: string): string[] {
    const dirs = Array.isArray(partials) ? partials : [partials];

    return dirs.map((dir) => path.resolve(rootDir, dir));
}

/**
 * Find all *.theme.js and *.theme.json files under a directory,
 * skipping node_modules, vendor, dist, and public directories.
 */
export function findPartialFiles(rootDir: string): string[] {
    const results: string[] = [];

    let entries: fs.Dirent[];

    try {
        const result = fs.readdirSync(rootDir, { withFileTypes: true, recursive: true });

        if (!Array.isArray(result)) {
            return results;
        }

        entries = result;
    } catch {
        return results;
    }

    for (const entry of entries) {
        if (!entry.isFile()) {
            continue;
        }

        if (!entry.name.endsWith(".theme.js")) {
            continue;
        }

        const rel = path.relative(rootDir, path.join(entry.parentPath, entry.name));
        const parts = rel.split(path.sep);

        if (parts.some((p) => IGNORE_DIRS.has(p))) {
            continue;
        }

        results.push(path.join(entry.parentPath, entry.name));
    }

    return results.sort();
}

/**
 * Load and merge partial theme files into the theme.json.
 */
export async function mergePartials(themeJson: ThemeJson, files: string[]): Promise<void> {
    for (const file of files) {
        const partial = await loadPartial(file);

        if (!partial) {
            continue;
        }

        applyPartial(themeJson, partial);
    }
}

/**
 * Load a single .theme.js partial file.
 */
async function loadPartial(file: string): Promise<Record<string, unknown> | null> {
    try {
        const url = `${path.resolve(file)}?t=${Date.now()}`;
        const mod = await import(url);

        return mod.default ?? null;
    } catch {
        return null;
    }
}

/**
 * Merge a partial into the theme.json.
 *
 * Supports two export shapes:
 * - Full: `{ styles: { blocks, elements } }` — merged at root
 * - Shorthand: `{ blocks, elements }` — merged into `styles`
 */
function applyPartial(themeJson: ThemeJson, partial: Record<string, unknown>): void {
    if (partial.styles) {
        deepMerge(themeJson as unknown as Record<string, unknown>, partial);
    }

    if (partial.blocks) {
        const styles = ((themeJson as Record<string, unknown>).styles ??= {}) as Record<
            string,
            unknown
        >;
        const blocks = (styles.blocks ??= {}) as Record<string, unknown>;

        deepMerge(blocks, partial.blocks as Record<string, unknown>);
    }

    if (partial.elements) {
        const styles = ((themeJson as Record<string, unknown>).styles ??= {}) as Record<
            string,
            unknown
        >;
        const elements = (styles.elements ??= {}) as Record<string, unknown>;

        deepMerge(elements, partial.elements as Record<string, unknown>);
    }
}
