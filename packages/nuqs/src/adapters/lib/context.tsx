import {
  createContext,
  useContext,
  type ParentComponent,
  type JSX
} from 'solid-js'
import type { Options } from '../../defs'
import { debugEnabled } from '../../lib/debug'
import { error } from '../../lib/errors'
import type { AdapterInterface, UseAdapterHook } from './defs'

export type AdapterProps = {
  defaultOptions?: Partial<
    Pick<Options, 'shallow' | 'clearOnDefault' | 'scroll' | 'limitUrlUpdates'>
  >
  processUrlSearchParams?: (search: URLSearchParams) => URLSearchParams
}

export type AdapterContext = AdapterProps & {
  useAdapter: UseAdapterHook
}

const defaultContext: AdapterContext = {
  useAdapter() {
    throw new Error(error(404))
  }
}

export const context: ReturnType<typeof createContext<AdapterContext>> = createContext<AdapterContext>(defaultContext)

declare global {
  interface Window {
    __NuqsAdapterContext?: typeof context
  }
}

if (debugEnabled && typeof window !== 'undefined') {
  if (window.__NuqsAdapterContext && window.__NuqsAdapterContext !== context) {
    console.error(error(303))
  }
  window.__NuqsAdapterContext = context
}

export type AdapterProvider = ParentComponent<AdapterProps>

/**
 * Create a custom adapter (context provider) for nuqs to work with your framework / router.
 *
 * Adapters are based on SolidJS Context.
 *
 * @param useAdapter - Hook that returns the adapter interface
 * @returns A provider component
 */
export function createAdapterProvider(
  useAdapter: UseAdapterHook
): AdapterProvider {
  return props => {
    const value: AdapterContext = {
      useAdapter,
      get defaultOptions() {
        return props.defaultOptions
      },
      get processUrlSearchParams() {
        return props.processUrlSearchParams
      }
    }
    return <context.Provider value={value}>{props.children}</context.Provider>
  }
}

export function useAdapter(watchKeys: string[]): AdapterInterface {
  const value = useContext(context)
  if (!('useAdapter' in value)) {
    throw new Error(error(404))
  }
  return value.useAdapter(() => watchKeys)
}

export const useAdapterDefaultOptions = (): AdapterProps['defaultOptions'] =>
  useContext(context).defaultOptions

export const useAdapterProcessUrlSearchParams =
  (): AdapterProps['processUrlSearchParams'] =>
    useContext(context).processUrlSearchParams
