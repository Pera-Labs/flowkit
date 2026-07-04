# FlowKit

Server-driven onboarding/paywall flows for React Native apps. FlowKit fetches
a small JSON config (flows, screens, SDUI templates) from a remote endpoint,
caches it on-device, and renders the active flow screen — falling back to
sane built-in defaults whenever the network, cache, or a screen reference is
unavailable. When no flow is active, it renders your app as-is.

## Install

```json
"dependencies": {
  "flowkit": "github:Pera-Labs/flowkit#v0.2.0"
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
| `state` | object | no | *(v0.2.0)* Live app state, exposed to templates as `@S.*`. |
| `catalogs` | object | no | *(v0.2.0)* Static list data (e.g. gear catalogs), exposed as `@catalog.*`. |
| `dataSources` | object | no | *(v0.2.0)* Map of `key -> { resolver: async () => value, refetchOn? }`. Resolved once on boot; exposed as `@rc.*` (see below). A rejected resolver sets an error state, it never crashes the app. |

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

`stack`, `row`, `card`, `divider`, `iconTile`, `text`, `image`, `button`, `choiceGrid`, `progressDots`, `spacer`, `badge`,
`starRating`, `coverArt`, `priceOptionList`, `freqChart`, `knobGauge`.
An unrecognized node type is skipped (renders nothing) and logs a `console.warn`.

Container primitives (`stack`, `row`, `card`) accept `props: { gap, align: 'start'|'center'|'end', justify, pad, wrap }` and an explicit `style` object that merges last. `stack` is column, `row` is horizontal. `divider` is a thin rule; `iconTile` is a round emoji/image chip (`{ icon, size }`).

### Tier-2 primitives (v0.2.0)

- **`starRating`** — a row of tappable stars (`props: { max, action, color, emptyColor, value? }`). Tapping star `i` calls `onAction(action, { value: i })`.
- **`coverArt`** — an image (`src`/`uri`) with a deterministic hashed-color + initials fallback when no URL is given (`fallbackText`/`fallbackSeed`, `size`, `radius`).
- **`priceOptionList`** — selectable rows rendered from a `source` array (typically `@rc.offerings`, already resolved to `[{id, title, price, perMonth, badge?}, ...]` by the binding layer). Tapping a row calls `onAction(action, item)`; `selectedId` highlights the matching row.
- **`freqChart`** — **static v0.2.0 approximation.** A row of vertical bars sized from a numeric `values`/`bars` array. Not animated or interactive — the animated dual-curve reveal used by ToneAdapt's `diff`/`promise`/`adapting` screens is deferred to a later release (needs real component code, not a JSON-only template).
- **`knobGauge`** — **static v0.2.0 approximation.** A labeled circle showing `value` + `label`. Not an animated radial dial — deferred, same reasoning as `freqChart`.

Deferred to a later release (need heavier native work or additional generic primitives not yet justified by enough screens): `searchInput`/`selectableList`/`stickyDock`/`noneRow` (gear screens), `signalChain`, `checkBadge`, `backBar`, `sectionLabel`, `tabContainer`.

## Data binding

Template string leaves can reference four kinds of live data (the template JSON itself stays static/serializable):

- **`$token`** — theme tokens, e.g. `$accent`, `$bg` (existing, resolved via `theme`).
- **`@S.<path>`** — live app state, from the `state` prop. `@S.guitar` → `state.guitar`. Dotted paths index into nested objects/arrays (`@S.list.0.name`).
- **`@catalog.<path>`** — static list/catalog data, from the `catalogs` prop. `@catalog.GUITARS`.
- **`@rc.<path>`** — resolved value of the `rc` entry in `dataSources` (conventionally RevenueCat offerings). `@rc.offerings`, `@rc.selectedPackageId`.

An unknown prefix, or a path that does not resolve, is left **as-is** (the raw `@...` string) — bindings never throw and never blank out a template.

### `dataSources` — async data (RevenueCat example)

```jsx
<FlowKitProvider
  appId="my-app"
  version="1.0.0"
  dataSources={{
    rc: {
      resolver: async () => {
        const offerings = await Purchases.getOfferings();
        return {
          offerings: mapPackagesToPriceOptionListItems(offerings.current),
          selectedPackageId: offerings.current.availablePackages[0]?.identifier,
        };
      },
    },
  }}
>
  <MainApp />
</FlowKitProvider>
```

The resolver runs once on boot. While it is pending, any node with a
matching `source: '@rc.<path>'` prop (e.g. `priceOptionList`) renders its
`loadingState` sub-template if provided, else nothing. If the resolver
rejects, it renders `errorState` if provided, else nothing. Once resolved,
the node renders normally with `@rc.*` bindings filled in.

### `when` — conditional visibility

Any SDUI node may carry a `when` string to gate whether it renders at all:

```json
{ "type": "button", "when": "!@isPro", "label": "Upgrade to Pro", "action": "nav.goto:paywall" }
```

Supported forms (a tiny hand-rolled parser — **no `eval`/`new Function`**):

- Bare truthy binding: `"@rc.offerings"`, `"@S.tier"`
- Negation: `"!@isPro"`
- Equality: `"@isPro === false"`, `"@S.tier === 'gold'"`, `"@S.tier !== 'gold'"`

Unprefixed shorthand flags (`@isPro`, `@flay.enabled`) resolve against `@S.*`
(i.e. `@isPro` ≡ `@S.isPro`) since that's where such flags conventionally
live; `@S.*`/`@catalog.*`/`@rc.*` prefixes still address their own source.

**Fail-open semantics:** any unrecognized form, or any error while
evaluating, resolves to `true` — FlowKit would rather show an extra node
than silently hide one due to a template typo.

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
