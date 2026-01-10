import { defineConfig, type Options, type UserConfig } from 'tsdown'

const commonConfig = {
  clean: true,
  format: ['esm'],
  dts: true,
  outDir: 'dist',
  external: ['solid-js', '@solidjs/router'],
  treeshake: true,
  tsconfig: 'tsconfig.build.json'
} satisfies Options

const entrypoints = {
  client: {
    index: 'src/index.ts',
    'adapters/solid': 'src/adapters/solid.ts',
    'adapters/solid-router': 'src/adapters/solid-router.ts',
    'adapters/custom': 'src/adapters/custom.ts',
    'adapters/testing': 'src/adapters/testing.tsx'
  },
  server: {
    server: 'src/index.server.ts',
    testing: 'src/testing.ts'
  }
}

const config: UserConfig = defineConfig([
  // Client bundles
  {
    ...commonConfig,
    entry: entrypoints.client
  },
  // Server bundle
  {
    ...commonConfig,
    entry: entrypoints.server
  }
]) as UserConfig

export default config
