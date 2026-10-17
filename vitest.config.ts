import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  // Unit tests build classes by hand, so DI metadata is not needed. Its emitted
  // `typeof X === 'function' ? X : Object` guards would show up as untested branches.
  oxc: { decorator: { legacy: true, emitDecoratorMetadata: false } },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      // Bootstrap and DI wiring only; exercised by the e2e suite, not unit tests.
      exclude: ['src/main.ts', 'src/**/*.module.ts', 'src/**/*.spec.ts'],
      thresholds: { 100: true },
    },
  },
});
