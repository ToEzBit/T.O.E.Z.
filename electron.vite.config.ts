import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

// Only the main process exists so far. The Panel (renderer) arrives in T6;
// add a `renderer` section then.
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: 'src/main/index.ts' },
      },
    },
  },
})
