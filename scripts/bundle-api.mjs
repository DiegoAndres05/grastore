import { mkdir, rm } from 'node:fs/promises'
import { build } from 'vite'

const outDir = '.api-build'
await rm(outDir, { recursive: true, force: true })
await mkdir('api', { recursive: true })

const routes = ['book', 'users']
for (const name of routes) {
  await build({
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    ssr: { noExternal: true },
    build: {
      ssr: `src/server/routes/${name}.ts`,
      outDir,
      emptyOutDir: false,
      rollupOptions: {
        output: { format: 'es', entryFileNames: `${name}.js` },
      },
    },
  })
  await rm(`api/${name}.js`, { force: true })
}

const { cp } = await import('node:fs/promises')
for (const name of routes) {
  await cp(`${outDir}/${name}.js`, `api/${name}.js`)
}
await rm(outDir, { recursive: true, force: true })
