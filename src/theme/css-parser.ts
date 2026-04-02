import { isCssWideKeyword } from '../utils.js';

/**
 * Extract the content of an @theme block.
 */
export function extractThemeContent(css: string): string | null {
    const themeMatch = css.match(/@(?:layer\s+)?theme\s*{/s);

    if (!themeMatch) return null;

    const startIndex = themeMatch.index! + themeMatch[0].length;

    let braceCount = 1;

    let position = startIndex;

    while (position < css.length) {
        // Handle escaped characters
        if (css[position] === '\\') {
            position += 2;
            continue;
        }

        // Handle string literals
        if (/['"]/.test(css[position])) {
            const quote = css[position];
            position++;

            while (position < css.length) {
                if (css[position] === '\\') {
                    position += 2;
                } else if (css[position] === quote) {
                    position++;
                    break;
                } else {
                    position++;
                }
            }

            continue;
        }

        // Handle comments
        if (css.slice(position, position + 2) === '/*') {
            position += 2;

            while (position < css.length) {
                if (css.slice(position, position + 2) === '*/') {
                    position += 2;
                    break;
                }

                position++;
            }

            continue;
        }

        // Handle braces
        if (css[position] === '{') braceCount++;
        if (css[position] === '}') braceCount--;

        if (braceCount === 0) {
            return css.substring(startIndex, position);
        }

        position++;
    }

    const blockType = themeMatch[0].trim();
    throw new Error(`Unclosed ${blockType} block - missing closing brace`);
}

/**
 * Extract CSS variable name/value pairs from a theme block.
 */
export function extractVariables(
    regex: RegExp,
    content: string | null
): Array<[string, string]> {
    if (!content) return [];

    const re = new RegExp(regex.source, regex.flags);

    const variables: Array<[string, string]> = [];
    let match: RegExpExecArray | null;

    while ((match = re.exec(content)) !== null) {
        const [, name, value] = match;

        if (name && value && !name.includes('*') && !isCssWideKeyword(value.trim())) {
            variables.push([name, value.trim()]);
        }
    }

    return variables;
}
