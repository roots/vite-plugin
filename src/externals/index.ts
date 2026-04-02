import {
    defaultRequestToExternal,
    defaultRequestToHandle,
} from '@wordpress/dependency-extraction-webpack-plugin/lib/util';
import type { Plugin as VitePlugin, Rolldown } from 'vite';
import type { WordPressPluginConfig } from '../types.js';
import { SUPPORTED_EXTENSIONS } from '../constants.js';
import { isExemptPackage } from '../utils.js';
import { resolveImport } from './transform.js';
import { createHmrCode, shouldInjectHmr } from './hmr.js';

/**
 * Transform WordPress imports into global references and
 * generate a dependency manifest for enqueuing.
 */
export function wordpressPlugin(
    config: WordPressPluginConfig = {}
): VitePlugin {
    const extensions = config.extensions ?? SUPPORTED_EXTENSIONS;
    const externalMappings = config.externalMappings ?? {};
    const dependencies = new Set<string>();

    const hmrConfig = {
        enabled: true,
        editorPattern: /editor/ as string | RegExp,
        iframeName: 'editor-canvas',
        ...config.hmr,
    };

    const hmrCode = createHmrCode(hmrConfig.iframeName);

    return {
        name: 'wordpress-plugin',
        enforce: 'pre',

        options(opts: Rolldown.InputOptions) {
            return {
                ...opts,
                external: (id: string): boolean => {
                    if (typeof id !== 'string') return false;

                    if (id in externalMappings) {
                        return true;
                    }

                    return (
                        id.startsWith('@wordpress/') &&
                        !isExemptPackage(id)
                    );
                },
            };
        },

        resolveId(id: string) {
            if (id in externalMappings) {
                const mapping = externalMappings[id];
                dependencies.add(mapping.handle);
                return { id, external: true };
            }

            if (!id?.startsWith('@wordpress/') || isExemptPackage(id))
                return null;

            const [external, handle] = [
                defaultRequestToExternal(id),
                defaultRequestToHandle(id),
            ];

            if (!external || !handle) return null;

            dependencies.add(handle);

            return { id, external: true };
        },

        transform(code: string, id: string) {
            const cleanId = id.split('?')[0];
            if (!extensions.some((ext) => cleanId.endsWith(ext))) return null;

            let transformedCode = code;

            // Handle custom external mappings
            for (const [packageName, mapping] of Object.entries(
                externalMappings
            )) {
                const customImportRegex = new RegExp(
                    `^[\\s\\n]*import[\\s\\n]+(?:([^;'"]+?)[\\s\\n]+from[\\s\\n]+)?['"]${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"][\\s\\n]*;?`,
                    'gm'
                );
                let match;

                while ((match = customImportRegex.exec(code)) !== null) {
                    const [fullMatch, imports] = match;
                    dependencies.add(mapping.handle);

                    const replacement = resolveImport(imports, mapping.global);

                    if (replacement) {
                        transformedCode = transformedCode.replace(
                            fullMatch,
                            replacement
                        );
                    } else {
                        transformedCode = transformedCode.replace(
                            fullMatch,
                            ''
                        );
                    }
                }
            }

            // Handle WordPress imports
            const importRegex =
                /^[\s\n]*import[\s\n]+(?:([^;'"]+?)[\s\n]+from[\s\n]+)?['"]@wordpress\/([^'"]+)['"][\s\n]*;?/gm;

            let match;

            while ((match = importRegex.exec(code)) !== null) {
                const [fullMatch, imports, pkg] = match;

                if (isExemptPackage(`@wordpress/${pkg}`)) {
                    continue;
                }

                const external = defaultRequestToExternal(
                    `@wordpress/${pkg}`
                );
                const handle = defaultRequestToHandle(`@wordpress/${pkg}`);

                if (!external || !handle) continue;

                dependencies.add(handle);

                const replacement = resolveImport(imports, external);

                if (replacement) {
                    transformedCode = transformedCode.replace(
                        fullMatch,
                        replacement
                    );
                } else {
                    transformedCode = transformedCode.replace(fullMatch, '');
                }
            }

            if (shouldInjectHmr(transformedCode, id, hmrConfig)) {
                transformedCode = `${transformedCode}\n${hmrCode}`;
            }

            return {
                code: transformedCode,
                map: null,
                moduleType: 'js',
            };
        },

        generateBundle() {
            this.emitFile({
                type: 'asset',
                name: 'editor.deps.json',
                originalFileName: 'editor.deps.json',
                source: JSON.stringify([...dependencies], null, 2),
            });
        },
    };
}
