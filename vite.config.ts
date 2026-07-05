import { defineConfig, type LibraryOptions, type UserConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const define = { __GT_VERSION__: JSON.stringify(pkg.version) }

// 四种构建模式（见 package.json scripts）：
//   production（默认） -> dist/gitalk.mjs        ESM，preact 外置
//   umd                -> dist/gitalk.js         UMD，preact 打入包内，未压缩
//   min                -> dist/gitalk.min.js     UMD，preact 打入包内，压缩（CDN 引用）
//   react              -> dist/react/index.{mjs,cjs}  React 薄封装出口
export default defineConfig(({ command, mode }) => {
  if (command === 'serve') {
    return {
      root: 'dev',
      oxc: jsxForPreact,
      define,
    }
  }

  if (mode === 'react') {
    return {
      oxc: jsxForPreact,
      define,
      build: {
        outDir: 'dist/react',
        emptyOutDir: true,
        sourcemap: true,
        lib: {
          entry: resolve(__dirname, 'react/index.ts'),
          formats: ['es', 'cjs'],
          fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.cjs'),
          cssFileName: 'gitalk',
        },
        rollupOptions: {
          external: ['react', 'react-dom', 'react/jsx-runtime', /^preact/],
        },
      },
      plugins: [
        dts({
          include: ['react', 'src'],
          entryRoot: 'react',
          outDirs: ['dist/react'],
          bundleTypes: true,
          tsconfigPath: './tsconfig.json',
          // bundleTypes 会把类型入口写到 package.json 的 types 路径（dist/index.d.ts），
          // react 出口需要落在 dist/react/ 下
          beforeWriteFile: (filePath, content) => {
            if (filePath.replace(/\\/g, '/').endsWith('dist/index.d.ts')) {
              return { filePath: resolve(__dirname, 'dist/react/index.d.ts'), content }
            }
          },
        }),
      ],
    } satisfies UserConfig
  }

  const isEsm = mode !== 'umd' && mode !== 'min'
  const isMin = mode === 'min'

  const lib: LibraryOptions = {
    entry: resolve(__dirname, 'src/index.ts'),
    name: 'Gitalk',
    formats: isEsm ? ['es'] : ['umd'],
    fileName: () => (isEsm ? 'gitalk.mjs' : isMin ? 'gitalk.min.js' : 'gitalk.js'),
    cssFileName: 'gitalk',
  }

  return {
    oxc: jsxForPreact,
    define,
    build: {
      outDir: 'dist',
      emptyOutDir: isEsm,
      sourcemap: true,
      minify: isMin,
      lib,
      rollupOptions: isEsm ? { external: [/^preact/] } : {},
    },
    plugins: isEsm
      ? [
          dts({
            include: ['src'],
            outDirs: ['dist'],
            bundleTypes: true,
            tsconfigPath: './tsconfig.json',
          }),
        ]
      : [],
  } satisfies UserConfig
})

const jsxForPreact = {
  jsx: {
    runtime: 'automatic' as const,
    importSource: 'preact',
  },
}
