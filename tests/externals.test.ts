/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { Plugin, TransformResult, Rolldown } from 'vite';

// Mock WordPress dependency extraction plugin before importing our plugin
vi.mock('@wordpress/dependency-extraction-webpack-plugin/lib/util', () => ({
    defaultRequestToExternal: vi.fn((request: string) => {
        if (request.startsWith('@wordpress/')) {
            const pkg = request.substring('@wordpress/'.length);
            return ['wp', pkg.replace(/-([a-z])/g, (_: string, letter: string) => letter.toUpperCase())];
        }

        return null;
    }),
    defaultRequestToHandle: vi.fn((request: string) => {
        if (request.startsWith('@wordpress/')) {
            return 'wp-' + request.substring('@wordpress/'.length);
        }

        return null;
    }),
}));

import { wordpressPlugin } from '../src/index.js';
import { shouldInjectHmr, createHmrCode } from '../src/externals/hmr.js';

describe('wordpressPlugin', () => {
    let plugin: Plugin;

    beforeEach(() => {
        plugin = wordpressPlugin();
    });

    describe('import transformation', () => {
        it('should transform named imports', () => {
            const code = `import { useState, useEffect } from '@wordpress/element';`;

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain(
                'const useState = wp.element.useState;'
            );
            expect(result?.code).toContain(
                'const useEffect = wp.element.useEffect;'
            );
        });

        it('should transform aliased named imports', () => {
            const code = `import { useState as useStateWP } from '@wordpress/element';`;

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain(
                'const useStateWP = wp.element.useState;'
            );
        });

        it('should transform namespace imports', () => {
            const code = `import * as element from '@wordpress/element';`;

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain('const element = wp.element;');
        });

        it('should transform default imports', () => {
            const code = `import apiFetch from '@wordpress/api-fetch';`;

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain('const apiFetch = wp.apiFetch;');
        });

        it('should transform side-effect imports', () => {
            const code = `import '@wordpress/block-editor';`;

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toBe('');
        });

        it('should handle multiple imports', () => {
            const code = `
            import { useState } from '@wordpress/element';
            import apiFetch from '@wordpress/api-fetch';
            import * as blocks from '@wordpress/blocks';
          `.trim();

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain(
                'const useState = wp.element.useState;'
            );
            expect(result?.code).toContain('const apiFetch = wp.apiFetch;');
            expect(result?.code).toContain('const blocks = wp.blocks;');
        });

        it('should only transform files with supported extensions', () => {
            const code = `import { useState } from '@wordpress/element';`;

            const result = (plugin.transform as any)?.(code, 'test.md');

            expect(result).toBeNull();
        });

        it('should preserve non-WordPress imports', () => {
            const code = `
            import { useState } from '@wordpress/element';
            import React from 'react';
            import styles from './styles.css';
          `.trim();

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain(
                'const useState = wp.element.useState;'
            );
            expect(result?.code).toContain("import React from 'react';");
            expect(result?.code).toContain(
                "import styles from './styles.css';"
            );
        });
    });

    describe('dependency tracking', () => {
        it('should track WordPress dependencies and generate manifest', () => {
            const code = `
            import { useState } from '@wordpress/element';
            import apiFetch from '@wordpress/api-fetch';
          `.trim();

            // Transform to trigger dependency tracking
            (plugin.transform as any)?.(code, 'test.tsx');

            // Mock emitFile to capture dependencies
            const emitFile = vi.fn();
            if (
                plugin.generateBundle &&
                typeof plugin.generateBundle === 'function'
            ) {
                const context = {
                    emitFile,
                    meta: {},
                    /* eslint-disable @typescript-eslint/no-unused-vars */
                    warn: (_message: string) => {
                        /* intentionally empty for tests */
                    },
                    error: (_message: string) => {
                        /* intentionally empty for tests */
                    },
                    /* eslint-enable @typescript-eslint/no-unused-vars */
                };

                plugin.generateBundle.call(
                    context as any,
                    {} as any,
                    {},
                    false
                );
            }

            expect(emitFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'editor.deps.json',
                    originalFileName: 'editor.deps.json',
                    type: 'asset',
                    source: JSON.stringify(
                        ['wp-element', 'wp-api-fetch'],
                        null,
                        2
                    ),
                })
            );
        });
    });

    describe('external handling', () => {
        it('should mark WordPress packages as external', () => {
            const result = (plugin.options as any)({
                input: 'src/index.ts',
            }) as Rolldown.InputOptions;

            const external = result.external as (id: string) => boolean;

            expect(external('@wordpress/element')).toBe(true);
            expect(external('@wordpress/components')).toBe(true);
            expect(external('@wordpress/blocks')).toBe(true);
        });

        it('should not mark non-WordPress packages as external', () => {
            const result = (plugin.options as any)({
                input: 'src/index.ts',
            }) as Rolldown.InputOptions;

            const external = result.external as (id: string) => boolean;

            expect(external('react')).toBe(false);
            expect(external('@emotion/react')).toBe(false);
            expect(external('./local-file')).toBe(false);
        });

        it('should handle non-string input IDs in external check', () => {
            const result = (plugin.options as any)({
                input: 'src/index.ts',
            }) as Rolldown.InputOptions;

            const external = result.external as (id: unknown) => boolean;

            expect(external(null)).toBe(false);
            expect(external(undefined)).toBe(false);
            expect(external(123)).toBe(false);
        });

        it('should preserve existing options while adding external handling', () => {
            const result = (plugin.options as any)({
                input: 'src/index.ts',
                treeshake: true,
                preserveEntrySignatures: 'strict' as const,
            }) as Rolldown.InputOptions;

            expect(result).toEqual(
                expect.objectContaining({
                    input: 'src/index.ts',
                    treeshake: true,
                    preserveEntrySignatures: 'strict',
                    external: expect.any(Function),
                })
            );
        });

        it('should not mark exempted WordPress packages as external', () => {
            const result = (plugin.options as any)({
                input: 'src/index.ts',
            }) as Rolldown.InputOptions;

            const external = result.external as (id: string) => boolean;

            expect(external('@wordpress/icons')).toBe(false);
            expect(external('@wordpress/dataviews')).toBe(false);
        });
    });

    describe('custom external mappings', () => {
        it('should transform named imports from custom packages', () => {
            const plugin = wordpressPlugin({
                externalMappings: {
                    'acf-input': {
                        global: ['acf', 'input'],
                        handle: 'acf-input',
                    },
                },
            });

            const code = `import { Field, FieldGroup } from 'acf-input';`;

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain('const Field = acf.input.Field;');
            expect(result?.code).toContain(
                'const FieldGroup = acf.input.FieldGroup;'
            );
        });

        it('should transform default imports from custom packages', () => {
            const plugin = wordpressPlugin({
                externalMappings: {
                    'woocommerce-blocks': {
                        global: ['wc', 'blocks'],
                        handle: 'wc-blocks',
                    },
                },
            });

            const code = `import WCBlocks from 'woocommerce-blocks';`;

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain('const WCBlocks = wc.blocks;');
        });

        it('should transform namespace imports from custom packages', () => {
            const plugin = wordpressPlugin({
                externalMappings: {
                    'acf-input': {
                        global: ['acf', 'input'],
                        handle: 'acf-input',
                    },
                },
            });

            const code = `import * as ACF from 'acf-input';`;

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain('const ACF = acf.input;');
        });

        it('should transform aliased named imports from custom packages', () => {
            const plugin = wordpressPlugin({
                externalMappings: {
                    'acf-input': {
                        global: ['acf', 'input'],
                        handle: 'acf-input',
                    },
                },
            });

            const code = `import { Field as ACFField } from 'acf-input';`;

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain('const ACFField = acf.input.Field;');
        });

        it('should handle side-effect imports from custom packages', () => {
            const plugin = wordpressPlugin({
                externalMappings: {
                    'acf-input': {
                        global: ['acf', 'input'],
                        handle: 'acf-input',
                    },
                },
            });

            const code = `import 'acf-input';`;

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toBe('');
        });

        it('should track custom package dependencies in manifest', () => {
            const plugin = wordpressPlugin({
                externalMappings: {
                    'acf-input': {
                        global: ['acf', 'input'],
                        handle: 'acf-input',
                    },
                    'woocommerce-blocks': {
                        global: ['wc', 'blocks'],
                        handle: 'wc-blocks',
                    },
                },
            });

            const code = `
                import { Field } from 'acf-input';
                import WCBlocks from 'woocommerce-blocks';
                import { useState } from '@wordpress/element';
            `.trim();

            // Transform to trigger dependency tracking
            (plugin.transform as any)?.(code, 'test.tsx');

            // Mock emitFile to capture dependencies
            const emitFile = vi.fn();
            if (
                plugin.generateBundle &&
                typeof plugin.generateBundle === 'function'
            ) {
                const context = {
                    emitFile,
                    meta: {},
                    /* eslint-disable @typescript-eslint/no-unused-vars */
                    warn: (_message: string) => {
                        /* intentionally empty for tests */
                    },
                    error: (_message: string) => {
                        /* intentionally empty for tests */
                    },
                    /* eslint-enable @typescript-eslint/no-unused-vars */
                };

                plugin.generateBundle.call(
                    context as any,
                    {} as any,
                    {},
                    false
                );
            }

            expect(emitFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'editor.deps.json',
                    source: JSON.stringify(
                        ['acf-input', 'wc-blocks', 'wp-element'],
                        null,
                        2
                    ),
                })
            );
        });

        it('should mark custom packages as external', () => {
            const plugin = wordpressPlugin({
                externalMappings: {
                    'acf-input': {
                        global: ['acf', 'input'],
                        handle: 'acf-input',
                    },
                },
            });

            const result = (plugin.options as any)({
                input: 'src/index.ts',
            }) as Rolldown.InputOptions;

            const external = result.external as (id: string) => boolean;

            expect(external('acf-input')).toBe(true);
        });

        it('should not mark non-configured packages as external', () => {
            const plugin = wordpressPlugin({
                externalMappings: {
                    'acf-input': {
                        global: ['acf', 'input'],
                        handle: 'acf-input',
                    },
                },
            });

            const result = (plugin.options as any)({
                input: 'src/index.ts',
            }) as Rolldown.InputOptions;

            const external = result.external as (id: string) => boolean;

            expect(external('some-other-package')).toBe(false);
        });

        it('should handle multiple custom packages in same file', () => {
            const plugin = wordpressPlugin({
                externalMappings: {
                    'acf-input': {
                        global: ['acf', 'input'],
                        handle: 'acf-input',
                    },
                    'woocommerce-blocks': {
                        global: ['wc', 'blocks'],
                        handle: 'wc-blocks',
                    },
                },
            });

            const code = `
                import { Field } from 'acf-input';
                import WCBlocks from 'woocommerce-blocks';
            `.trim();

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain('const Field = acf.input.Field;');
            expect(result?.code).toContain('const WCBlocks = wc.blocks;');
        });

        it('should preserve non-custom imports', () => {
            const plugin = wordpressPlugin({
                externalMappings: {
                    'acf-input': {
                        global: ['acf', 'input'],
                        handle: 'acf-input',
                    },
                },
            });

            const code = `
                import { Field } from 'acf-input';
                import React from 'react';
                import styles from './styles.css';
            `.trim();

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain('const Field = acf.input.Field;');
            expect(result?.code).toContain("import React from 'react';");
            expect(result?.code).toContain(
                "import styles from './styles.css';"
            );
        });

        it('should handle packages with special characters in names', () => {
            const plugin = wordpressPlugin({
                externalMappings: {
                    '@my/scoped-package': {
                        global: ['myPackage'],
                        handle: 'my-scoped-package',
                    },
                },
            });

            const code = `import { Component } from '@my/scoped-package';`;

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain(
                'const Component = myPackage.Component;'
            );
        });

        it('should work with both custom and WordPress packages', () => {
            const plugin = wordpressPlugin({
                externalMappings: {
                    'acf-input': {
                        global: ['acf', 'input'],
                        handle: 'acf-input',
                    },
                },
            });

            const code = `
                import { Field } from 'acf-input';
                import { useState } from '@wordpress/element';
            `.trim();

            const result = (plugin.transform as any)?.(
                code,
                'test.tsx'
            ) as TransformResult;

            expect(result).toBeDefined();
            expect(result?.code).toContain('const Field = acf.input.Field;');
            expect(result?.code).toContain(
                'const useState = wp.element.useState;'
            );
        });
    });
});

describe('shouldInjectHmr', () => {
    it('should return true when enabled and id matches string pattern', () => {
        expect(shouldInjectHmr('const x = 1;', 'src/editor.ts', {
            enabled: true,
            editorPattern: 'editor',
        })).toBe(true);
    });

    it('should return true when enabled and id matches regex pattern', () => {
        expect(shouldInjectHmr('const x = 1;', 'src/editor.ts', {
            enabled: true,
            editorPattern: /editor/,
        })).toBe(true);
    });

    it('should return false when disabled', () => {
        expect(shouldInjectHmr('const x = 1;', 'src/editor.ts', {
            enabled: false,
            editorPattern: 'editor',
        })).toBe(false);
    });

    it('should return false when id does not match pattern', () => {
        expect(shouldInjectHmr('const x = 1;', 'src/app.ts', {
            enabled: true,
            editorPattern: 'editor',
        })).toBe(false);
    });

    it('should return false when code already contains HMR snippet', () => {
        expect(shouldInjectHmr('import.meta.hot.on("vite:beforeUpdate", () => {})', 'src/editor.ts', {
            enabled: true,
            editorPattern: 'editor',
        })).toBe(false);
    });
});

describe('createHmrCode', () => {
    it('should include the iframe name in the generated code', () => {
        const code = createHmrCode('editor-canvas');

        expect(code).toContain('iframe[name="editor-canvas"]');
    });

    it('should use a custom iframe name', () => {
        const code = createHmrCode('my-custom-iframe');

        expect(code).toContain('iframe[name="my-custom-iframe"]');
    });

    it('should include import.meta.hot guard', () => {
        const code = createHmrCode('editor-canvas');

        expect(code).toContain('import.meta.hot');
    });

    it('should listen for vite:beforeUpdate events', () => {
        const code = createHmrCode('editor-canvas');

        expect(code).toContain('vite:beforeUpdate');
    });
});
