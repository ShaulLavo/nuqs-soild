import {
  createSignal,
  createEffect,
  onCleanup,
  createMemo,
  type Accessor
} from 'solid-js'
import { createAdapterProvider, type AdapterProvider } from './lib/context'
import type { AdapterInterface } from './lib/defs'

/**
 * Adapter for SolidJS with @solidjs/router
 */
function useSolidRouterAdapter(
  watchKeys: Accessor<string[]>
): AdapterInterface {
  // Lazy import to avoid server-side issues during testing
  const { useSearchParams } = require('@solidjs/router')
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentSearchParams, setCurrentSearchParams] = createSignal(
    new URLSearchParams()
  )

  // Convert solid-router's searchParams to URLSearchParams
  createEffect(() => {
    const params = new URLSearchParams()
    Object.entries(searchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v))
      } else if (
        value !== undefined &&
        value !== null &&
        typeof value === 'string'
      ) {
        params.set(key, value)
      }
    })
    setCurrentSearchParams(params)
  })

  const updateUrl = (search: URLSearchParams) => {
    const newParams: Record<string, string | string[]> = {}

    // Convert URLSearchParams back to solid-router format
    for (const [key, value] of search.entries()) {
      const existing = newParams[key]
      if (existing === undefined) {
        newParams[key] = value
      } else if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        newParams[key] = [existing, value]
      }
    }

    // Clear keys that are not in the new params but were in the old ones
    Object.keys(searchParams).forEach(key => {
      if (!(key in newParams)) {
        newParams[key] = undefined as any
      }
    })

    setSearchParams(newParams, {
      resolve: false, // Don't resolve relative to current location
      scroll: false // Don't scroll to top
    })

    return Promise.resolve(search)
  }

  const getSearchParamsSnapshot = () => currentSearchParams()

  // Rate limit factor for browser history API
  const rateLimitFactor = createMemo(() => {
    // Safari requires higher rate limiting
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    return isSafari ? 120 : 50
  })

  return {
    searchParams: currentSearchParams,
    updateUrl,
    getSearchParamsSnapshot,
    rateLimitFactor: rateLimitFactor()
  }
}

/**
 * Provider component for SolidJS with @solidjs/router
 * Integrates with @solidjs/router's useSearchParams hook
 */
export const NuqsAdapter: AdapterProvider = createAdapterProvider(
  useSolidRouterAdapter
)
