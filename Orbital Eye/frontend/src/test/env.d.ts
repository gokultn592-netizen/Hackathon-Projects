/**
 * Ambient module declarations for the Vite-specific import suffixes used by
 * the test suite.
 */

declare module '*?raw' {
  const content: string;
  export default content;
}
