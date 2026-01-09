/**
 * SolidJS transition start function signature
 * Similar to the return value of useTransition()[1]
 */
export type TransitionStartFunction = (fn: () => void) => void

export type SearchParams = Record<string, string | string[] | undefined>
export type HistoryOptions = 'replace' | 'push'
export type LimitUrlUpdates =
  | { method: 'debounce'; timeMs: number }
  | { method: 'throttle'; timeMs: number }

export type Options = {
  /**
   * How the query update affects page history
   *
   * `push` will create a new history entry, allowing to use the back/forward
   * buttons to navigate state updates.
   * `replace` (default) will keep the current history point and only replace
   * the query string.
   */
  history?: HistoryOptions

  /**
   * Scroll to top after a query state update
   *
   * Defaults to `false`.
   */
  scroll?: boolean

  /**
   * Shallow mode (true by default) keeps query states update client-side only,
   * meaning there won't be calls to the server.
   *
   * Setting it to `false` will trigger a network request to the server with
   * the updated querystring.
   */
  shallow?: boolean

  /**
   * Maximum amount of time (ms) to wait between updates of the URL query string.
   *
   * This is to alleviate rate-limiting of the Web History API in browsers,
   * and defaults to 50ms. Safari requires a higher value of around 120ms.
   *
   * Note: the value will be limited to a minimum of 50ms, anything lower
   * will not have any effect.
   *
   * @deprecated use `limitUrlUpdates: { 'method': 'throttle', timeMs: number }`
   * or use the shorthand:
   * ```ts
   * import { throttle } from 'nuqs-solid'
   *
   * limitUrlUpdates: throttle(100) // time in ms
   * ```
   */
  throttleMs?: number

  /**
   * Limit the rate of URL updates to prevent spamming the browser history,
   * and the server if `shallow: false`.
   *
   * This is to alleviate rate-limiting of the Web History API in browsers,
   * and defaults to 50ms. Safari requires a higher value of around 120ms.
   *
   * Note: the value will be limited to a minimum of 50ms, anything lower
   * will not have any effect.
   *
   * If both `throttleMs` and `limitUrlUpdates` are set, `limitUrlUpdates` will
   * take precedence.
   */
  limitUrlUpdates?: LimitUrlUpdates

  /**
   * Opt-in to wrapping URL updates in a Solid transition by passing
   * a `startTransition` from the `useTransition()` hook.
   *
   * This can be used to defer commit until async processes are complete.
   */
  startTransition?: TransitionStartFunction

  /**
   * Clear the key-value pair from the URL query string when setting the state
   * to the default value.
   *
   * Defaults to `true` to keep URLs clean.
   *
   * Set it to `false` to keep backwards-compatiblity when the default value
   * changes (prefer explicit URLs whose meaning don't change).
   */
  clearOnDefault?: boolean
}

export type Nullable<T> = {
  [K in keyof T]: T[K] | null
} & {}

/**
 * Helper type to define and reuse urlKey options to rename search params keys
 *
 * Usage:
 * ```ts
 * import { type UrlKeys } from 'nuqs-solid' // or 'nuqs-solid/server'
 *
 * export const coordinatesSearchParams = {
 *   latitude: parseAsFloat.withDefault(0),
 *   longitude: parseAsFloat.withDefault(0),
 * }
 * export const coordinatesUrlKeys: UrlKeys<typeof coordinatesSearchParams> = {
 *   latitude: 'lat',
 *   longitude: 'lng',
 * }
 *
 * // Later in the code:
 * useQueryStates(coordinatesSearchParams, {
 *   urlKeys: coordinatesUrlKeys
 * })
 * createSerializer(coordinatesSearchParams, {
 *   urlKeys: coordinatesUrlKeys
 * })
 * createSearchParamsCache(coordinatesSearchParams, {
 *   urlKeys: coordinatesUrlKeys
 * })
 * ```
 */
export type UrlKeys<Parsers extends Record<string, any>> = Partial<
  Record<keyof Parsers, string>
>
