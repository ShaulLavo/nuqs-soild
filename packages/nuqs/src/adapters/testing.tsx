import {
  createSignal,
  createEffect,
  onMount,
  type ParentComponent,
  type JSX
} from 'solid-js'
import { resetQueues } from '../lib/queues/reset'
import { renderQueryString } from './custom'
import { context, type AdapterProps } from './lib/context'
import type { AdapterInterface, AdapterOptions } from './lib/defs'

export type UrlUpdateEvent = {
  searchParams: URLSearchParams
  queryString: string
  options: Required<AdapterOptions>
}

export type OnUrlUpdateFunction = (event: UrlUpdateEvent) => void

type TestingAdapterProps = Pick<AdapterInterface, 'autoResetQueueOnUpdate'> & {
  /**
   * An initial value for the search params.
   */
  searchParams?: string | Record<string, string> | URLSearchParams

  /**
   * A function that will be called whenever the URL is updated.
   * Connect that to a spy in your tests to assert the URL updates.
   */
  onUrlUpdate?: OnUrlUpdateFunction

  /**
   * Internal: enable throttling during tests.
   *
   * @default 0 (no throttling)
   */
  rateLimitFactor?: number

  /**
   * Internal: Whether to reset the url update queue on mount.
   *
   * Since the update queue is a shared global, each test clears
   * it on mount to avoid interference between tests.
   *
   * @default true
   */
  resetUrlUpdateQueueOnMount?: boolean

  /**
   * If true, the adapter will store the search params in memory and
   * update that memory on each updateUrl call, to simulate a real adapter.
   *
   * Otherwise, the search params will be frozen to the initial value.
   *
   * @default false
   */
  hasMemory?: boolean

  children: JSX.Element
} & AdapterProps

function renderInitialSearchParams(
  searchParams: TestingAdapterProps['searchParams']
): string {
  if (!searchParams) {
    return ''
  }
  if (typeof searchParams === 'string') {
    return searchParams
  }
  if (searchParams instanceof URLSearchParams) {
    return searchParams.toString()
  }
  return new URLSearchParams(searchParams).toString()
}

export const NuqsTestingAdapter: ParentComponent<TestingAdapterProps> = (props) => {
  const renderedInitialSearchParams = renderInitialSearchParams(props.searchParams)
  
  // Simulate a central location.search in memory
  // for the getSearchParamsSnapshot to be referentially stable.
  let locationSearchRef = renderedInitialSearchParams
  
  if (props.resetUrlUpdateQueueOnMount ?? true) {
    onMount(() => resetQueues())
  }
  
  const [searchParams, setSearchParams] = createSignal(
    new URLSearchParams(locationSearchRef)
  )
  
  createEffect(() => {
    if (!props.hasMemory) {
      return
    }
    const synced = new URLSearchParams(props.searchParams)
    setSearchParams(synced)
    locationSearchRef = synced.toString()
  })
  
  const updateUrl: AdapterInterface['updateUrl'] = (search, options) => {
    const queryString = renderQueryString(search)
    const searchParamsObj = new URLSearchParams(search) // make a copy
    if (props.hasMemory) {
      setSearchParams(searchParamsObj)
      locationSearchRef = queryString
    }
    props.onUrlUpdate?.({
      searchParams: searchParamsObj,
      queryString,
      options
    })
  }
  
  const getSearchParamsSnapshot = () => {
    return new URLSearchParams(locationSearchRef)
  }
  
  const useAdapter = (): AdapterInterface => ({
    searchParams,
    updateUrl,
    getSearchParamsSnapshot,
    rateLimitFactor: props.rateLimitFactor ?? 0,
    autoResetQueueOnUpdate: props.autoResetQueueOnUpdate
  })
  
  const value = {
    useAdapter,
    get defaultOptions() {
      return props.defaultOptions
    },
    get processUrlSearchParams() {
      return props.processUrlSearchParams
    }
  }
  
  return (
    <context.Provider value={value}>
      {props.children}
    </context.Provider>
  )
}

/**
 * A higher order component that wraps the children with the NuqsTestingAdapter
 *
 * It allows creating wrappers for testing purposes by providing only the
 * necessary props to the NuqsTestingAdapter.
 *
 * Usage:
 * ```tsx
 * render(<MyComponent />, {
 *   wrapper: withNuqsTestingAdapter({ searchParams: '?foo=bar' })
 * })
 * ```
 */
export function withNuqsTestingAdapter(
  props: Omit<TestingAdapterProps, 'children'> = {}
) {
  return function NuqsTestingAdapterWrapper(wrapperProps: { children: JSX.Element }): JSX.Element {
    return (
      <NuqsTestingAdapter {...props}>
        {wrapperProps.children}
      </NuqsTestingAdapter>
    )
  }
}
