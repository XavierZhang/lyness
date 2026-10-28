#!/usr/bin/env node

import { Context } from '@lyness/cordis'
import { pathToFileURL } from 'node:url'
import Loader from '@lyness/cordis-plugin-loader'

const ctx = new Context()
ctx.baseUrl = pathToFileURL(process.cwd()).href + '/'

await ctx.plugin(Loader)
await ctx.loader.create({
  name: '@lyness/cordis-plugin-include',
  config: {
    path: './cordis.yml',
  },
})
