// TODO: SSR support for SolidStart will be added in a future version
// This file is currently disabled for SSR to remove framework dependencies

import type { SearchParams, UrlKeys } from './defs'
import { error } from './lib/errors'
import { createLoader, type LoaderFunctionOptions } from './loader'
import type { inferParserType, ParserMap } from './parsers'

const $input: unique symbol = Symbol('Input')

type CacheInterface<Parsers extends ParserMap> = {
  parse: {
    /**
     * Parse the incoming `searchParams` using the parsers provided.
     *
     * Note: SSR support is disabled for now. SolidStart integration will be added later.
     *
     * @argument searchParams - The search params object.
     * @argument loaderOptions.strict - When `true`, the loader will throw an error
     *  if a search params value is invalid for the given parser, rather than falling
     * back to the parser's default value (or `null` if no default is set).
     *
     * @returns The parsed search params for direct use.
     */
    (
      searchParams: SearchParams,
      loaderOptions?: LoaderFunctionOptions
    ): inferParserType<Parsers>

    /**
     * Parse the incoming `searchParams` (Promise version).
     *
     * Note: SSR support is disabled for now. SolidStart integration will be added later.
     *
     * @argument searchParams - The search params object (Promise).
     * @argument loaderOptions.strict - When `true`, the Promise returned from the loader
     * will reject if a search params value is invalid for the given parser,
     * rather than falling back to the parser's default value (or `null` if no default is set).
     *
     * @returns The parsed search params for direct use.
     */
    (
      searchParams: Promise<unknown>,
      loaderOptions?: LoaderFunctionOptions
    ): Promise<inferParserType<Parsers>>
  }
  all: () => inferParserType<Parsers>
  get: <Key extends keyof Parsers>(key: Key) => inferParserType<Parsers[Key]>
}

export function createSearchParamsCache<Parsers extends ParserMap>(
  parsers: Parsers,
  { urlKeys = {} }: { urlKeys?: UrlKeys<Parsers> } = {}
): CacheInterface<Parsers> {
  const load = createLoader(parsers, { urlKeys })
  type Keys = keyof Parsers
  type ParsedSearchParams = inferParserType<Parsers>

  type Cache = {
    searchParams: Partial<ParsedSearchParams>
    [$input]?: SearchParams
  }

  // Simple in-memory cache for client-side use
  // TODO: Replace with SolidStart's cache when SSR support is added
  let cache: Cache = { searchParams: {} }

  const getCache = (): Cache => cache

  function parseSync(
    searchParams: SearchParams,
    loaderOptions: LoaderFunctionOptions
  ): ParsedSearchParams {
    const c = getCache()
    if (Object.isFrozen(c.searchParams)) {
      // Parse has already been called...
      if (c[$input] && compareSearchParams(searchParams, c[$input])) {
        // ...but we're being called with the same contents again,
        // so we can safely return the same cached result
        return all()
      }
      // Different inputs in the same request - fail
      throw new Error(error(501))
    }
    c.searchParams = load(searchParams, loaderOptions)
    c[$input] = searchParams
    return Object.freeze(c.searchParams) as ParsedSearchParams
  }

  function parse(
    searchParams: SearchParams,
    loaderOptions?: LoaderFunctionOptions
  ): ParsedSearchParams
  function parse(
    searchParams: Promise<unknown>,
    loaderOptions?: LoaderFunctionOptions
  ): Promise<ParsedSearchParams>
  function parse(
    searchParams: SearchParams | Promise<unknown>,
    loaderOptions: LoaderFunctionOptions = {}
  ) {
    if (searchParams instanceof Promise) {
      return searchParams.then(searchParams =>
        parseSync(searchParams as SearchParams, loaderOptions)
      )
    }
    return parseSync(searchParams, loaderOptions)
  }
  function all() {
    const { searchParams } = getCache()
    if (Object.keys(searchParams).length === 0) {
      throw new Error(error(500))
    }
    return searchParams as ParsedSearchParams
  }
  function get<Key extends Keys>(key: Key): ParsedSearchParams[Key] {
    const { searchParams } = getCache()
    const entry = searchParams[key]
    if (typeof entry === 'undefined') {
      throw new Error(
        error(500) +
          `
  in get(${String(key)})`
      )
    }
    return entry as ParsedSearchParams[Key]
  }
  return { parse, get, all }
}

export function compareSearchParams(a: SearchParams, b: SearchParams): boolean {
  if (a === b) {
    return true
  }
  if (Object.keys(a).length !== Object.keys(b).length) {
    return false
  }
  for (const key in a) {
    if (a[key] !== b[key]) {
      return false
    }
  }
  return true
}
