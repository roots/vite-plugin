/**
 * Parse named imports from a destructured import statement.
 */
function extractNamedImports(imports: string): string[] {
    const match = imports.match(/{([^}]+)}/);
    return (
        match?.[1]
            ?.split(",")
            .map((s: string) => s.trim())
            .filter(Boolean) ?? []
    );
}

/**
 * Transform named imports into global variable assignments.
 */
function handleNamedReplacement(namedImports: string[], external: string[]): string {
    const externalPath = external.join(".");

    return namedImports
        .map((importStr) => {
            const parts = importStr.split(" as ").map((s) => s.trim());
            const name = parts[0];
            const alias = parts[1] ?? name;

            return `const ${alias} = ${externalPath}.${name};`;
        })
        .join("\n");
}

/**
 * Resolve an import statement into its global variable replacement.
 */
export function resolveImport(imports: string | undefined, globalPath: string[]): string | null {
    if (!imports) return null;

    if (imports.includes("{")) {
        return handleNamedReplacement(extractNamedImports(imports), globalPath);
    }

    if (imports.includes("*")) {
        const namespaceAlias = imports.match(/\*\s+as\s+(\w+)/)?.[1];

        if (namespaceAlias) {
            return `const ${namespaceAlias} = ${globalPath.join(".")};`;
        }
    } else {
        const defaultImport = imports.match(/^(\w+)/)?.[1];

        if (defaultImport) {
            return `const ${defaultImport} = ${globalPath.join(".")};`;
        }
    }

    return null;
}
