# Vite Plugin for WordPress

<a href="https://github.com/roots/vite-plugin/blob/main/LICENSE.md"><img alt="MIT License" src="https://img.shields.io/github/license/roots/vite-plugin?color=%23525ddc&style=flat-square"></a>
<a href="https://www.npmjs.com/package/@roots/vite-plugin"><img alt="npm version" src="https://img.shields.io/npm/v/@roots/vite-plugin.svg?color=%23525ddc&style=flat-square"></a>
<a href="https://github.com/roots/vite-plugin/actions/workflows/tests.yml"><img alt="Build Status" src="https://img.shields.io/github/actions/workflow/status/roots/vite-plugin/tests.yml?color=%23525ddc&style=flat-square"></a>
<a href="https://bsky.app/profile/roots.dev"><img alt="Follow roots.dev on Bluesky" src="https://img.shields.io/badge/follow-@roots.dev-0085ff?logo=bluesky&style=flat-square"></a>

Here lives a Vite plugin for WordPress development.

## Features

- 🔄 Transforms `@wordpress/*` imports into global `wp.*` references
- 📦 Generates dependency manifest for WordPress enqueuing
- 🎨 Generates theme.json from Tailwind CSS configuration
- 🔥 Hot Module Replacement (HMR) support for the WordPress editor

## Installation

```bash
npm install @roots/vite-plugin --save-dev
```

## Usage

Start by adding the base plugin to your Vite config:

```js
// vite.config.js
import { defineConfig } from 'vite';
import { wordpressPlugin } from '@roots/vite-plugin';

export default defineConfig({
  plugins: [wordpressPlugin()],
});
```

Once you've added the plugin, WordPress dependencies referenced in your code will be transformed into global `wp.*` references.

When WordPress dependencies are transformed, a manifest containing the required dependencies will be generated called `editor.deps.json`.

### Editor HMR Support

The plugin automatically enables CSS Hot Module Replacement (HMR) for the WordPress editor. By default, it will handle CSS updates for any file named `editor.css` without requiring a full page reload.

> **Note:** JavaScript HMR is not supported at this time. JS changes will trigger a full page reload.

You can customize the HMR behavior in your Vite config:

```js
// vite.config.js
import { defineConfig } from 'vite';
import { wordpressPlugin } from '@roots/vite-plugin';

export default defineConfig({
  plugins: [
    wordpressPlugin({
      hmr: {
        // Enable/disable HMR (default: true)
        enabled: true,

        // Pattern to match editor entry points (default: /editor/)
        editorPattern: /editor/,

        // Pattern to match editor CSS files (default: 'editor.css')
        cssPattern: 'editor.css',

        // Name of the editor iframe element (default: 'editor-canvas')
        iframeName: 'editor-canvas',
      },
    }),
  ],
});
```

### Theme.json Generation

When using this plugin for theme development, you have the option of generating a `theme.json` file from your Tailwind CSS configuration.

To enable this feature, add the `wordpressThemeJson` plugin to your Vite config:

```js
// vite.config.js
import { defineConfig } from 'vite';
import { wordpressThemeJson } from '@roots/vite-plugin';

export default defineConfig({
  plugins: [
    wordpressThemeJson({
      // Optional: Configure shade labels
      shadeLabels: {
        100: 'Lightest',
        900: 'Darkest',
      },

      // Optional: Disable specific transformations
      disableTailwindColors: false,
      disableTailwindFonts: false,
      disableTailwindFontSizes: false,

      // Optional: Configure paths
      baseThemeJsonPath: './theme.json',
      outputPath: 'assets/theme.json',
      cssFile: 'app.css',

      // Optional: Legacy Tailwind config path
      tailwindConfig: './tailwind.config.js',
    }),
  ],
});
```
