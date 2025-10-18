declare module '@wordpress/dependency-extraction-webpack-plugin/lib/util' {
  export function defaultRequestToExternal(request: string): string[] | null;
  export function defaultRequestToHandle(request: string): string | null;
}

// Backward compatibility for older imports with .js extension
declare module '@wordpress/dependency-extraction-webpack-plugin/lib/util.js' {
  export function defaultRequestToExternal(request: string): string[] | null;
  export function defaultRequestToHandle(request: string): string | null;
}
