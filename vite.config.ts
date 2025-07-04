import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'))

export default defineConfig(({ mode, command }) => {
  // Development mode - serve the demo
  if (command === 'serve') {
    return {
      plugins: [react()],
      root: 'demo',
      resolve: {
        alias: {
          '@': resolve(__dirname, './src'),
          '@reserve-protocol/react-zapper': resolve(__dirname, './src/index.ts'),
        },
      },
    }
  }
  
  // Build mode for demo
  if (mode === 'demo') {
    return {
      plugins: [react()],
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
    react(),
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
  }
})