import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { lingui } from '@lingui/vite-plugin'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'))

// Lingui macros are compiled away at build time, and the `lingui()` plugin
// turns `.po` catalog imports into plain message objects — so the published
// bundle is framework-agnostic JS and consumers need none of this tooling.
const reactWithMacros = () => react({ babel: { plugins: ['macros'] } })

export default defineConfig(({ mode, command }) => {
  // Development mode - serve the demo (which serves the lib source directly,
  // so it needs the macro + catalog transforms too).
  if (command === 'serve') {
    return {
      plugins: [reactWithMacros(), lingui()],
      root: 'demo',
      resolve: {
        alias: {
          '@': resolve(__dirname, './src'),
          '@reserve-protocol/react-zapper': resolve(__dirname, './src/index.ts'),
        },
      },
      assetsInclude: ['**/*.svg'],
    }
  }
  
  // Build mode for demo
  if (mode === 'demo') {
    return {
      plugins: [reactWithMacros(), lingui()],
      root: 'demo',
      build: {
        outDir: '../dist-demo',
        emptyOutDir: true,
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, './src'),
          '@reserve-protocol/react-zapper': resolve(__dirname, './src/index.ts'),
        },
      },
    }
  }

  // Library build configuration
  return {
  plugins: [
    reactWithMacros(),
    lingui(),
    dts({
      insertTypesEntry: true,
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'demo/**/*'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ReactZapper',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'esm' : 'cjs'}.js`,
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        ...Object.keys(packageJson.peerDependencies || {}),
        ...Object.keys(packageJson.dependencies || {}),
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg'],
  }
})