import {
  createSignal,
  createEffect,
  onCleanup,
  type Component,
  type JSX
} from 'solid-js'

type NullDetectorProps = {
  state: unknown
  enabled?: boolean
} & JSX.HTMLAttributes<HTMLPreElement>

export const NullDetector: Component<NullDetectorProps> = props => {
  const [hasBeenNullAtSomePoint, setHasBeenNullAtSomePoint] = createSignal(
    props.enabled !== false ? props.state === null : false
  )

  createEffect(() => {
    if (props.enabled === false || props.state !== null) {
      return
    }
    setHasBeenNullAtSomePoint(true)
  })

  return <pre {...props}>{hasBeenNullAtSomePoint() ? 'fail' : 'pass'}</pre>
}

export function useFakeLoadingState(trigger: unknown): () => boolean {
  const [isLoading, setIsLoading] = createSignal(false)

  createEffect(() => {
    if (!trigger) {
      return
    }
    setIsLoading(true)
    const timeout = setTimeout(() => {
      setIsLoading(false)
    }, 100)
    onCleanup(() => clearTimeout(timeout))
  })

  return isLoading
}
