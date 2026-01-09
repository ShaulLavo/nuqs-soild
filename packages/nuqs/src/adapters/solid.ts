import {
  createSignal,
  createEffect,
  onCleanup,
  createMemo,
  type Accessor
} from 'solid-js'
import { createAdapterProvider, type AdapterProvider } from './lib/context'
import type { AdapterInterface } from './lib/defs'
import { renderQueryString } from '../lib/url-encoding'

/**
 * Adapter for SolidJS using window.location directly (no router)
 */
function useSolidAdapter(watchKeys: Accessor<string[]>): AdapterInterface {
  const [searchParams, setSearchParams] = createSignal(
    new URLSearchParams(window.location.search)
  )

  const updateUrl = (search: URLSearchParams) => {
    const url = new URL(window.location.href)
    url.search = search.toString()
    window.history.replaceState(null, '', url.toString())
    setSearchParams(new URLSearchParams(search))
    return Promise.resolve(search)
  }

  const getSearchParamsSnapshot = () => searchParams()

  // Listen for popstate events (back/forward navigation)
  createEffect(() => {
    const handlePopState = () => {
      setSearchParams(new URLSearchParams(window.location.search))
    }

    window.addEventListener('popstate', handlePopState)
    onCleanup(() => {
      window.removeEventListener('popstate', handlePopState)
    })
  })

  // Rate limit factor for browser history API
  const rateLimitFactor = createMemo(() => {
    // Safari requires higher rate limiting
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    return isSafari ? 120 : 50
  })

  return {
    searchParams,
    updateUrl,
    getSearchParamsSnapshot,
    rateLimitFactor: rateLimitFactor()
  }
}

/**
 * Provider component for SolidJS without router
 * Uses window.location directly for URL management
 */
export const NuqsAdapter: AdapterProvider =
  createAdapterProvider(useSolidAdapter)
