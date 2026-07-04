# FlowKit

Server-driven onboarding/paywall flows for React Native apps. FlowKit fetches
a small JSON config (flows, screens, SDUI templates) from a remote endpoint,
caches it on-device, and renders the active flow screen — falling back to
sane built-in defaults whenever the network, cache, or a screen reference is
unavailable. When no flow is active, it renders your app as-is.

## Install

```json
"dependencies": {
  "flowkit": "github:Pera-Labs/flowkit#v0.1.1"
}
```

## Usage

```jsx
import { FlowKitProvider } from 'flowkit';

export default function App() {
  return (
    <FlowKitProvider appId="my-app" version="1.0.0" actions={{ 'purchase.buy': (arg) => buy(arg) }}>
      <MainApp />
    </FlowKitProvider>
  );
}
```

`FlowKitProvider` renders the current onboarding/paywall screen while a flow
is active, and renders `children` (your app) once the flow resolves to
`main`.

## Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `appId` | string | yes | Identifies this app's config on the remote endpoint and in local storage. |
| `version` | string | yes | App version, sent with config fetches (server can gate by version). |
| `endpoint` | string | no | Config API base URL. Defaults to the public FlowKit endpoint (`https://appscreenshots.studio/api`). |
| `theme` | object | no | Partial theme overrides, merged over `DEFAULT_THEME`. |
| `screens` | object | no | Map of `id -> React component` for native (non-SDUI) screens, and a registry of ids the sequencer treats as "available". |
| `actions` | object | no | Map of action-name -> handler for `nav.goto`, `purchase.*`, and `custom:*` actions. |
| `defaultConfig` | object | no | Overrides the built-in `DEFAULT_CONFIG(appId)` used when no cached/remote config is available. |

`useFlowKit()` returns `{ dispatch(actionStr, payload?), config, entry }` for
any descendant that needs to trigger a flow action manually.

## Actions

SDUI screen nodes carry an `action` string, dispatched via `dispatch(action, payload?)`:

- `flow.next` — advance to the next screen in the current flow.
- `flow.skip` — mark the current flow complete and jump to its `endAction`.
- `flow.goto:<flowId>` — jump directly to another flow.
- `nav.goto` — calls `actions['nav.goto'](arg, payload)` if provided, then returns to `main`.
- `purchase.buy`, `purchase.restore` (and any other `purchase.*`) — calls `actions['purchase.buy'](arg, payload, api)`, etc. Unhandled purchase actions warn and no-op.
- `custom:<name>` or `custom:<name>:<rest>` — calls `actions[<name>](rest, payload, api)`. Unhandled custom actions warn and no-op.

Handlers receive `(arg, payload, api)` — the third argument is the FlowKit
API object (same shape as `useFlowKit()`), so a handler can itself call
`api.dispatch('flow.next')` after finishing async work (e.g. completing a
purchase before advancing the flow).

## SDUI node types

`stack`, `row`, `card`, `divider`, `iconTile`, `text`, `image`, `button`, `choiceGrid`, `progressDots`, `spacer`, `badge`.
An unrecognized node type is skipped (renders nothing) and logs a `console.warn`.

Container primitives (`stack`, `row`, `card`) accept `props: { gap, align: 'start'|'center'|'end', justify, pad, wrap }` and an explicit `style` object that merges last. `stack` is column, `row` is horizontal. `divider` is a thin rule; `iconTile` is a round emoji/image chip (`{ icon, size }`).

## Fail-safe behavior

FlowKit never blocks or crashes the host app:

- No network / stale cache → falls back to the last cached config, then to
  the built-in `DEFAULT_CONFIG` / `DEFAULT_SCREENS` templates.
- Unknown screen id or missing native component → skipped, sequencer moves
  to `main`.
- Unknown SDUI node type → skipped with a warning, siblings still render.
- Unhandled action → warns and no-ops instead of throwing.
- Remote config refresh runs in the background and only updates the cache
  for the *next* app launch — it never mutates the flow already on screen.
