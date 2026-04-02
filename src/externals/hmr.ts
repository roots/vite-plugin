/**
 * Generate the HMR snippet for CSS hot-reloading in the editor iframe.
 */
export function createHmrCode(iframeName: string): string {
    return `
if (import.meta.hot) {
    import.meta.hot.on('vite:beforeUpdate', ({ updates }) => {
        const editorIframe = document.querySelector('iframe[name="${iframeName}"]');
        const editor = editorIframe?.contentDocument;

        if (!editor) {
            return;
        }

        updates.forEach(({ path, type }) => {
            if (type !== 'css-update') {
                return;
            }

            const key = path.split('?')[0];

            editor.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                if (!link.href.includes(key)) {
                    return;
                }

                const updated = link.href.split('?')[0] + '?direct&t=' + Date.now();

                link.href = updated;
            });

            editor.querySelectorAll('style').forEach(style => {
                if (!style.textContent.includes(key)) {
                    return;
                }

                const importRegex = new RegExp(\`(@import\\\\s*(?:url\\\\(['"]?|['"]))(.*?\${key}[^'"\\\\)]*?)(?:\\\\?[^'"\\\\)]*)?(['"]?\\\\))\`, 'g');

                style.textContent = style.textContent.replace(importRegex, (_, prefix, importPath, suffix) => {
                    const updated = importPath.split('?')[0];

                    return prefix + updated + '?direct&t=' + Date.now() + suffix;
                });
            });
        });
    });
}`;
}

/**
 * Determine whether HMR code should be injected into the given module.
 */
export function shouldInjectHmr(
    code: string,
    id: string,
    config: { enabled: boolean; editorPattern: string | RegExp }
): boolean {
    if (!config.enabled) return false;
    if (code.includes('vite:beforeUpdate')) return false;

    if (typeof config.editorPattern === 'string') {
        return id.includes(config.editorPattern);
    }

    return config.editorPattern.test(id);
}
