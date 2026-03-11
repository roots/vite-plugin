# Vite Plugin for WordPress

<a href="https://www.npmjs.com/package/@roots/vite-plugin"><img alt="npm version" src="https://img.shields.io/npm/v/@roots/vite-plugin.svg?color=%23525ddc&style=flat-square"></a>
<a href="https://www.npmjs.com/package/@roots/vite-plugin"><img alt="npm downloads" src="https://img.shields.io/npm/dt/@roots/vite-plugin?label=downloads&colorB=2b3072&colorA=525ddc&style=flat-square"></a>
<a href="https://github.com/roots/vite-plugin/actions/workflows/tests.yml"><img alt="Build Status" src="https://img.shields.io/github/actions/workflow/status/roots/vite-plugin/tests.yml?color=%23525ddc&style=flat-square"></a>
<a href="https://twitter.com/rootswp"><img alt="Follow Roots" src="https://img.shields.io/badge/follow%20@rootswp-1da1f2?logo=twitter&logoColor=ffffff&message=&style=flat-square"></a>
<a href="https://github.com/sponsors/roots"><img src="https://img.shields.io/badge/sponsor%20roots-525ddc?logo=github&style=flat-square&logoColor=ffffff&message=" alt="Sponsor Roots"></a>

Here lives a Vite plugin for WordPress development.

## Support us

We're dedicated to pushing modern WordPress development forward through our open source projects, and we need your support to keep building. You can support our work by purchasing [Radicle](https://roots.io/radicle/), our recommended WordPress stack, or by [sponsoring us on GitHub](https://github.com/sponsors/roots). Every contribution directly helps us create better tools for the WordPress ecosystem.

## Features

- 🔄 Transforms `@wordpress/*` imports into global `wp.*` references
- 📦 Generates dependency manifest for WordPress enqueuing
- 🎨 Generates theme.json from Tailwind CSS configuration (colors, fonts, font sizes, border radius)
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

### External Mappings for Third-Party Plugins

The plugin can also handle third-party WordPress plugins that expose global JavaScript APIs, such as Advanced Custom Fields (ACF) or WooCommerce. This allows you to import these dependencies in your code while ensuring they're treated as external dependencies and properly enqueued by WordPress.

```js
// vite.config.js
import { defineConfig } from 'vite';
import { wordpressPlugin } from '@roots/vite-plugin';

export default defineConfig({
  plugins: [
    wordpressPlugin({
      externalMappings: {
        'acf-input': {
          global: ['acf', 'input'],
          handle: 'acf-input'
        },
        'woocommerce-blocks': {
          global: ['wc', 'blocks'],
          handle: 'wc-blocks'
        }
      }
    }),
  ],
});
```

With this configuration, you can import from these packages in your code:

```js
import { Field, FieldGroup } from 'acf-input';
import { registerBlockType } from 'woocommerce-blocks';
```

The plugin will transform these imports into global references:

```js
const Field = acf.input.Field;
const FieldGroup = acf.input.FieldGroup;
const registerBlockType = wc.blocks.registerBlockType;
```

The `handle` value is added to the dependency manifest (`editor.deps.json`) so WordPress knows to enqueue these scripts before your code runs.

### Editor HMR Support

The plugin automatically enables CSS Hot Module Replacement (HMR) for the WordPress editor.

> [!NOTE]
> JavaScript HMR is not supported at this time. JS changes will trigger a full page reload.

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

      // Optional: Configure font family labels
      fontLabels: {
        sans: 'Sans Serif',
        mono: 'Monospace',
        inter: 'Inter Font',
      },

      // Optional: Configure font size labels
      fontSizeLabels: {
        sm: 'Small',
        base: 'Default',
        lg: 'Large',
      },

      // Optional: Configure border radius labels
      borderRadiusLabels: {
        sm: 'Small',
        md: 'Medium',
        lg: 'Large',
        full: 'Full',
      },

      // Optional: Disable specific transformations
      disableTailwindColors: false,
      disableTailwindFonts: false,
      disableTailwindFontSizes: false,
      disableTailwindBorderRadius: false,

      // Optional: Configure paths
      baseThemeJsonPath: './theme.json',
      outputPath: 'assets/theme.json',
      cssFile: 'app.css',

      // Optional: Legacy Tailwind v3 config path
      tailwindConfig: './tailwind.config.js',
    }),
  ],
});
```

By default, Tailwind v4 will only [generate CSS variables](https://tailwindcss.com/docs/theme#generating-all-css-variables) that are discovered in your source files.

To generate the full default Tailwind color palette into your `theme.json`, you can use the `static` theme option when importing Tailwind:

```css
@import 'tailwindcss' theme(static);
```

#### Border Radius Presets

Tailwind's `--radius-*` CSS variables are automatically extracted into `settings.border.radiusSizes` in theme.json, enabling the border radius preset selector in the WordPress editor.

The same applies for customized colors in the `@theme` directive. To ensure your colors get generated, you can use another form of the `static` theme option:

```css
@theme static {
  --color-white: #fff;
  --color-purple: #3f3cbb;
  --color-midnight: #121063;
  --color-tahiti: #3ab7bf;
  --color-bermuda: #78dcca;
}
```

## Community

Keep track of development and community news.

- Join us on Discord by [sponsoring us on GitHub](https://github.com/sponsors/roots)
- Join us on [Roots Discourse](https://discourse.roots.io/)
- Follow [@rootswp on Twitter](https://twitter.com/rootswp)
- Follow the [Roots Blog](https://roots.io/blog/)
- Subscribe to the [Roots Newsletter](https://roots.io/subscribe/)
