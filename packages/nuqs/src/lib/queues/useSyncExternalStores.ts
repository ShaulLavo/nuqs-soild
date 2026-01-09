import { createEffect, onCleanup } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'

/**
 * Subscribe to multiple keys in an external store.
 *
 * @param getKeys - Accessor for the list of keys to subscribe to.
 * @param subscribeKey - Function to subscribe to a single key.
 * @param getKeySnapshot - Function to get the current value for a key.
 */
export function useSyncExternalStores<T>(
  getKeys: () => string[],
  subscribeKey: (key: string, callback: () => void) => () => void,
  getKeySnapshot: (key: string) => T
): Record<string, T> {
  const [store, setStore] = createStore<Record<string, T>>({})

  createEffect(() => {
    const keys = getKeys()

    // Initialize/Sync all keys
    const currentValues = Object.fromEntries(
      keys.map(key => [key, getKeySnapshot(key)])
    )
    setStore(reconcile(currentValues))

    // Subscribe to updates
    const unsubscribes = keys.map(key => {
      return subscribeKey(key, () => {
        setStore(key, getKeySnapshot(key) as any)
      })
    })

    onCleanup(() => {
      unsubscribes.forEach(unsubscribe => unsubscribe())
    })
  })

  return store
}
