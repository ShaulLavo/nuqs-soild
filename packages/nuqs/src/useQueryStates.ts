import {
  createSignal,
  createEffect,
  createUniqueId,
  createMemo,
  batch
} from 'solid-js'
import {
  useAdapter,
  useAdapterDefaultOptions,
  useAdapterProcessUrlSearchParams
} from './adapters/lib/context'
import type { Nullable, Options, UrlKeys } from './defs'
import { compareQuery } from './lib/compare'
import { debug } from './lib/debug'
import { error } from './lib/errors'
import { debounceController } from './lib/queues/debounce'
import { defaultRateLimit } from './lib/queues/rate-limiting'
import {
  globalThrottleQueue,
  type UpdateQueuePushArgs
} from './lib/queues/throttle'
import { safeParse } from './lib/safe-parse'
import { isAbsentFromUrl, type Query } from './lib/search-params'
import { emitter, type CrossHookSyncPayload } from './lib/sync'
import { type GenericParser } from './parsers'

type KeyMapValue<Type> = GenericParser<Type> &
  Options & {
    defaultValue?: Type
  }

export type UseQueryStatesKeysMap<Map = any> = {
  [Key in keyof Map]: KeyMapValue<Map[Key]>
} & {}

export type UseQueryStatesOptions<KeyMap extends UseQueryStatesKeysMap> =
  Options & {
    urlKeys: UrlKeys<KeyMap>
  }

export type Values<T extends UseQueryStatesKeysMap> = {
  [K in keyof T]: T[K]['defaultValue'] extends NonNullable<
    ReturnType<T[K]['parse']>
  >
    ? NonNullable<ReturnType<T[K]['parse']>>
    : ReturnType<T[K]['parse']> | null
}
type NullableValues<T extends UseQueryStatesKeysMap> = Nullable<Values<T>>

type UpdaterFn<T extends UseQueryStatesKeysMap> = (
  old: Values<T>
) => Partial<Nullable<Values<T>>> | null

export type SetValues<T extends UseQueryStatesKeysMap> = (
  values: Partial<Nullable<Values<T>>> | UpdaterFn<T> | null,
  options?: Options
) => Promise<URLSearchParams>

export type UseQueryStatesReturn<T extends UseQueryStatesKeysMap> = [
  () => Values<T>,
  SetValues<T>
]

// Ensure referential consistency for the default value of urlKeys
// by hoisting it out of the function scope.
// Otherwise useEffect loops go brrrr
const defaultUrlKeys = {}

/**
 * Synchronise multiple query string arguments to SolidJS state
 *
 * @param keys - An object describing the keys to synchronise and how to
 *               serialise and parse them.
 *               Use `parseAs(String|Integer|Float|...)` for quick shorthands.
 * @param options - Optional history mode, shallow routing and scroll restoration options.
 */
export function useQueryStates<KeyMap extends UseQueryStatesKeysMap>(
  keyMap: KeyMap,
  options: Partial<UseQueryStatesOptions<KeyMap>> = {}
): UseQueryStatesReturn<KeyMap> {
  const hookId = createUniqueId()
  const defaultOptions = useAdapterDefaultOptions()
  const processUrlSearchParams = useAdapterProcessUrlSearchParams()

  const {
    history = 'replace',
    scroll = defaultOptions?.scroll ?? false,
    shallow = defaultOptions?.shallow ?? true,
    throttleMs = defaultRateLimit.timeMs,
    limitUrlUpdates = defaultOptions?.limitUrlUpdates,
    clearOnDefault = defaultOptions?.clearOnDefault ?? true,
    startTransition,
    urlKeys = defaultUrlKeys as UrlKeys<KeyMap>
  } = options

  type V = NullableValues<KeyMap>
  const stateKeys = Object.keys(keyMap).join(',')
  const resolvedUrlKeys = createMemo(() =>
    Object.fromEntries(
      Object.keys(keyMap).map(key => [key, urlKeys[key] ?? key])
    )
  )
  const adapter = useAdapter(Object.values(resolvedUrlKeys()))
  const initialSearchParams = adapter.searchParams()
  let queryRef: Record<string, Query | null> = {}
  const defaultValues = createMemo(
    () =>
      Object.fromEntries(
        Object.keys(keyMap).map(key => [key, keyMap[key]!.defaultValue ?? null])
      ) as Values<KeyMap>
  )
  const queuedQueries = debounceController.useQueuedQueries(() =>
    Object.values(resolvedUrlKeys())
  )
  const [internalState, setInternalState] = createSignal<V>(
    parseMap(keyMap, urlKeys, initialSearchParams, queuedQueries).state
  )

  let stateRef = internalState()
  debug(
    '[nuq+ %s `%s`] render - state: %O, iSP: %s',
    hookId,
    stateKeys,
    internalState(),
    initialSearchParams
  )

  // Initialise the refs with the initial values
  createEffect(() => {
    const currentResolvedUrlKeys = resolvedUrlKeys()
    if (
      Object.keys(queryRef).join('&') !==
      Object.values(currentResolvedUrlKeys).join('&')
    ) {
      const { state, hasChanged } = parseMap(
        keyMap,
        urlKeys,
        initialSearchParams,
        queuedQueries,
        queryRef,
        stateRef
      )
      if (hasChanged) {
        debug('[nuq+ %s `%s`] State changed: %O', hookId, stateKeys, {
          state,
          initialSearchParams,
          queuedQueries,
          queryRef,
          stateRef
        })
        stateRef = state
        batch(() => setInternalState(() => state))
      }
      queryRef = Object.fromEntries(
        Object.entries(currentResolvedUrlKeys).map(([key, urlKey]) => {
          const parser = keyMap[key]
          return [
            urlKey,
            parser?.type === 'multi'
              ? initialSearchParams?.getAll(urlKey)
              : (initialSearchParams?.get(urlKey) ?? null)
          ]
        })
      )
    }
  })

  createEffect(() => {
    const currentResolvedUrlKeys = resolvedUrlKeys()
    const { state, hasChanged } = parseMap(
      keyMap,
      urlKeys,
      initialSearchParams,
      queuedQueries,
      queryRef,
      stateRef
    )
    if (hasChanged) {
      debug('[nuq+ %s `%s`] State changed: %O', hookId, stateKeys, {
        state,
        initialSearchParams,
        queuedQueries,
        queryRef,
        stateRef
      })
      stateRef = state
      batch(() => setInternalState(() => state))
    }
  })

  // Sync all hooks together & with external URL changes
  createEffect(() => {
    const currentResolvedUrlKeys = resolvedUrlKeys()
    const handlers = Object.keys(keyMap).reduce(
      (handlers, stateKey) => {
        handlers[stateKey as keyof KeyMap] = ({
          state,
          query
        }: CrossHookSyncPayload) => {
          batch(() => {
            setInternalState(currentState => {
              const { defaultValue } = keyMap[stateKey]!
              const urlKey = currentResolvedUrlKeys[stateKey]!
              const nextValue = state ?? defaultValue ?? null
              const currentValue =
                currentState[stateKey] ?? defaultValue ?? null

              if (Object.is(currentValue, nextValue)) {
                debug(
                  '[nuq+ %s `%s`] Cross-hook key sync %s: %O (default: %O). no change, skipping, resolved: %O',
                  hookId,
                  stateKeys,
                  urlKey,
                  state,
                  defaultValue,
                  stateRef
                )
                // bail out by returning the current state
                return currentState
              }
              // Note: cannot mutate in-place, the object ref must change
              // for the subsequent setState to pick it up.
              stateRef = {
                ...stateRef,
                [stateKey as keyof KeyMap]: nextValue
              }
              queryRef[urlKey] = query
              debug(
                '[nuq+ %s `%s`] Cross-hook key sync %s: %O (default: %O). updateInternalState, resolved: %O',
                hookId,
                stateKeys,
                urlKey,
                state,
                defaultValue,
                stateRef
              )
              return stateRef
            })
          })
        }
        return handlers
      },
      {} as Record<keyof KeyMap, (payload: CrossHookSyncPayload) => void>
    )

    for (const stateKey of Object.keys(keyMap)) {
      const urlKey = currentResolvedUrlKeys[stateKey]!
      debug(
        '[nuq+ %s `%s`] Subscribing to sync for `%s`',
        hookId,
        urlKey,
        stateKeys
      )
      emitter.on(urlKey, handlers[stateKey]!)
    }
    return () => {
      for (const stateKey of Object.keys(keyMap)) {
        const urlKey = currentResolvedUrlKeys[stateKey]!
        debug(
          '[nuq+ %s `%s`] Unsubscribing to sync for `%s`',
          hookId,
          urlKey,
          stateKeys
        )
        emitter.off(urlKey, handlers[stateKey])
      }
    }
  })

  const update: SetValues<KeyMap> = (stateUpdater, callOptions = {}) => {
    const nullMap = Object.fromEntries(
      Object.keys(keyMap).map(key => [key, null])
    ) as Nullable<KeyMap>
    const newState: Partial<Nullable<KeyMap>> =
      typeof stateUpdater === 'function'
        ? (stateUpdater(applyDefaultValues(stateRef, defaultValues())) ??
          nullMap)
        : (stateUpdater ?? nullMap)
    debug('[nuq+ %s `%s`] setState: %O', hookId, stateKeys, newState)
    let returnedPromise: Promise<URLSearchParams> | undefined = undefined
    let maxDebounceTime = 0
    let doFlush = false
    const debounceAborts: Array<
      (p: Promise<URLSearchParams>) => Promise<URLSearchParams>
    > = []
    const currentResolvedUrlKeys = resolvedUrlKeys()
    for (let [stateKey, value] of Object.entries(newState)) {
      const parser = keyMap[stateKey]
      const urlKey = currentResolvedUrlKeys[stateKey]!
      if (!parser || value === undefined) {
        continue
      }
      if (
        (callOptions.clearOnDefault ??
          parser.clearOnDefault ??
          clearOnDefault) &&
        value !== null &&
        parser.defaultValue !== undefined &&
        (parser.eq ?? ((a, b) => a === b))(value, parser.defaultValue)
      ) {
        value = null
      }
      const query = value === null ? null : (parser.serialize ?? String)(value)
      emitter.emit(urlKey, { state: value, query })
      const update: UpdateQueuePushArgs = {
        key: urlKey,
        query,
        options: {
          // Call-level options take precedence over individual parser options
          // which take precedence over global options
          history: callOptions.history ?? parser.history ?? history,
          shallow: callOptions.shallow ?? parser.shallow ?? shallow,
          scroll: callOptions.scroll ?? parser.scroll ?? scroll,
          startTransition:
            callOptions.startTransition ??
            parser.startTransition ??
            startTransition
        }
      }
      if (
        callOptions?.limitUrlUpdates?.method === 'debounce' ||
        limitUrlUpdates?.method === 'debounce' ||
        parser.limitUrlUpdates?.method === 'debounce'
      ) {
        if (update.options.shallow === true) {
          console.warn(error(422))
        }
        const timeMs =
          callOptions?.limitUrlUpdates?.timeMs ??
          limitUrlUpdates?.timeMs ??
          parser.limitUrlUpdates?.timeMs ??
          defaultRateLimit.timeMs
        const debouncedPromise = debounceController.push(
          update,
          timeMs,
          adapter,
          processUrlSearchParams
        )
        if (maxDebounceTime < timeMs) {
          // The largest debounce is likely to be the last URL update,
          // so we keep that Promise to return it.
          returnedPromise = debouncedPromise
          maxDebounceTime = timeMs
        }
      } else {
        const timeMs =
          callOptions?.limitUrlUpdates?.timeMs ??
          parser?.limitUrlUpdates?.timeMs ??
          limitUrlUpdates?.timeMs ??
          callOptions.throttleMs ??
          parser.throttleMs ??
          throttleMs
        debounceAborts.push(debounceController.abort(urlKey))
        globalThrottleQueue.push(update, timeMs)
        doFlush = true
      }
    }
    // We need to flush the throttle queue, but we may have a pending
    // debounced update that will resolve afterwards.
    const globalPromise = debounceAborts.reduce(
      (previous, fn) => fn(previous),
      doFlush
        ? globalThrottleQueue.flush(adapter, processUrlSearchParams)
        : globalThrottleQueue.getPendingPromise(adapter)
    )
    return returnedPromise ?? globalPromise
  }

  const outputState = createMemo(() =>
    applyDefaultValues(internalState(), defaultValues())
  )
  return [outputState, update]
}

// --

function parseMap<KeyMap extends UseQueryStatesKeysMap>(
  keyMap: KeyMap,
  urlKeys: Partial<Record<keyof KeyMap, string>>,
  searchParams: URLSearchParams,
  queuedQueries: Record<string, Query | null | undefined>,
  cachedQuery?: Record<string, Query | null>,
  cachedState?: NullableValues<KeyMap>
): {
  state: NullableValues<KeyMap>
  hasChanged: boolean
} {
  let hasChanged = false
  const state = Object.entries(keyMap).reduce((out, [stateKey, parser]) => {
    const urlKey = urlKeys?.[stateKey] ?? stateKey
    const queuedQuery = queuedQueries[urlKey]
    const fallbackValue = parser.type === 'multi' ? [] : null
    const query =
      queuedQuery === undefined
        ? ((parser.type === 'multi'
            ? searchParams?.getAll(urlKey)
            : searchParams?.get(urlKey)) ?? fallbackValue)
        : queuedQuery
    if (
      cachedQuery &&
      cachedState &&
      compareQuery(cachedQuery[urlKey] ?? fallbackValue, query)
    ) {
      // Cache hit
      out[stateKey as keyof KeyMap] = cachedState[stateKey] ?? null
      return out
    }
    // Cache miss
    hasChanged = true
    const value = isAbsentFromUrl(query)
      ? null
      : // we have properly narrowed `query` here, but TS doesn't keep track of that
        safeParse(parser.parse, query as string & Array<string>, urlKey)

    out[stateKey as keyof KeyMap] = value ?? null
    if (cachedQuery) {
      cachedQuery[urlKey] = query
    }
    return out
  }, {} as NullableValues<KeyMap>)

  if (!hasChanged) {
    // check that keyMap keys have not changed
    const keyMapKeys = Object.keys(keyMap)
    const cachedStateKeys = Object.keys(cachedState ?? {})
    hasChanged =
      keyMapKeys.length !== cachedStateKeys.length ||
      keyMapKeys.some(key => !cachedStateKeys.includes(key))
  }

  return { state, hasChanged }
}

function applyDefaultValues<KeyMap extends UseQueryStatesKeysMap>(
  state: NullableValues<KeyMap>,
  defaults: Partial<Values<KeyMap>>
) {
  return Object.fromEntries(
    Object.keys(state).map(key => [key, state[key] ?? defaults[key] ?? null])
  ) as Values<KeyMap>
}
