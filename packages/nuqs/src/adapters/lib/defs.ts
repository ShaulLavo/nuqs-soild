import type { Accessor } from 'solid-js'
import type { Options } from '../../defs'

export type AdapterOptions = Pick<Options, 'history' | 'scroll' | 'shallow'>

export type UpdateUrlFunction = (
  search: URLSearchParams,
  options: Required<AdapterOptions>
) => void

export type UseAdapterHook = (watchKeys: Accessor<string[]>) => AdapterInterface

export type AdapterInterface = {
  searchParams: Accessor<URLSearchParams>
  updateUrl: UpdateUrlFunction
  getSearchParamsSnapshot?: () => URLSearchParams
  rateLimitFactor?: number
  autoResetQueueOnUpdate?: boolean
}
