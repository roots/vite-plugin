# Vite Plugin for WordPress

![MIT License](https://img.shields.io/github/license/roots/vite-plugin?color=%23525ddc&style=flat-square)
![npm](https://img.shields.io/npm/v/@roots/vite-plugin.svg?color=%23525ddc&style=flat-square)
![Build Status](https://img.shields.io/github/actions/workflow/status/roots/vite-plugin/tests.yml?color=%23525ddc&style=flat-square)
![Follow Roots](https://img.shields.io/twitter/follow/rootswp.svg?color=%23525ddc&style=flat-square)

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

To enable HMR support in the WordPress editor, add the following to your editor entry point:

```js
// editor.js
import { wordpressEditorHmr } from '@roots/vite-plugin';

if (import.meta.hot) {
  // Default usage - looks for 'editor.css'
  wordpressEditorHmr(import.meta.hot);

  // Optional: Specify a custom CSS filename
  wordpressEditorHmr(import.meta.hot, 'custom-editor.css');
}
```

This will enable CSS hot reloading in the WordPress editor without requiring a full page refresh. By default, it looks for a file named `editor.css`, but you can specify a custom filename if needed.

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
      // Optional: Disable specific transformations
      disableTailwindColors: false,
      disableTailwindFonts: false,
      disableTailwindFontSizes: false,

      // Optional: Configure paths
      baseThemeJsonPath: './theme.json',
      outputPath: 'assets/theme.json',
      cssFile: 'app.css',
    }),
  ],
});
```
