# nuqs-solid

Type-safe search params state manager for SolidJS - Like createSignal, but stored in the URL query string.

## Installation

```bash
bun add nuqs-solid
# For solid-router integration
bun add @solidjs/router
```

## Quick Start

### 1. Add the Provider

Choose the appropriate adapter for your setup:

#### Without Router (using window.location)

```tsx
import { NuqsAdapter } from 'nuqs-solid/adapters/solid'

function App() {
  return (
    <NuqsAdapter>
      <MyComponent />
    </NuqsAdapter>
  )
}
```

#### With Solid Router

```tsx
import { NuqsAdapter } from 'nuqs-solid/adapters/solid-router'
import { Router } from '@solidjs/router'

function App() {
  return (
    <Router>
      <NuqsAdapter>
        <MyComponent />
      </NuqsAdapter>
    </Router>
  )
}
```

### 2. Use the Hook

```tsx
import { useQueryState, parseAsInteger } from 'nuqs-solid'

function Counter() {
  const [count, setCount] = useQueryState(
    'count',
    parseAsInteger.withDefault(0)
  )

  return (
    <div>
      <span>Count: {count()}</span>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <button onClick={() => setCount(c => c - 1)}>Decrement</button>
      <button onClick={() => setCount(null)}>Reset</button>
    </div>
  )
}
```

## Key Differences from React Version

- **Reactive Values**: State values are accessor functions (`count()`) instead of direct values
- **Return Type**: `[Accessor<T>, Setter<T>]` instead of `[T, (value) => Promise]`
- **SolidJS Patterns**: Uses SolidJS reactivity system with signals and effects

## API Reference

### useQueryState

```tsx
const [state, setState] = useQueryState(key, parser?)
```

- `state`: Accessor function that returns the current value
- `setState`: Function to update the state
- `key`: URL query parameter key
- `parser`: Optional parser for type conversion and validation

### useQueryStates

```tsx
const [states, setStates] = useQueryStates(parsers, options?)
```

Manage multiple query parameters at once.

### Parsers

All parsers from the original nuqs are available:

- `parseAsString`
- `parseAsInteger`
- `parseAsFloat`
- `parseAsBoolean`
- `parseAsJson`
- `parseAsArrayOf`
- And more...

## Migration Status

This package is a complete SolidJS port of [nuqs](https://github.com/47ng/nuqs). The core functionality has been successfully migrated and is ready for use.

See `MIGRATION_PLAN.md` for detailed migration status and implementation notes.
