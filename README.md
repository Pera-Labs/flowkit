# FlowKit

Server-driven onboarding/paywall flows for React Native apps. FlowKit fetches
a small JSON config (flows, screens, SDUI templates) from a remote endpoint,
caches it on-device, and renders the active flow screen — falling back to
sane built-in defaults whenever the network, cache, or a screen reference is
unavailable. When no flow is active, it renders your app as-is.

## Install

```json
"dependencies": {
  "flowkit": "github:Pera-Labs/flowkit#v0.4.0"
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
| `appInfo` | object | no | *(v0.4.0)* Overrides/supplies any `@app.*` field (see below). Use this when your app already resolves `expo-application`/`expo-constants`/`expo-updates` itself (e.g. a bare workflow), or to supply `reviewVersion`, `reviewUrl`, `supportEmail`. |

`useFlowKit()` returns `{ dispatch(actionStr, payload?), config, entry }` for
any descendant that needs to trigger a flow action manually.

## Actions

SDUI screen nodes carry an `action` string, dispatched via `dispatch(action, payload?)`:

- `flow.next` — advance to the next screen in the current flow.
- `flow.skip` — mark the current flow complete and jump to its `endAction`.
- `flow.goto:<flowId>` — jump directly to another flow.
- `nav.goto` — calls `actions['nav.goto'](arg, payload)` if provided, then returns to `main`.
- `nav.back` *(v0.3.0)* — calls `actions['nav.back'](arg, payload, api)` if the host registered one; otherwise steps back one screen in the current flow (or returns to `main` if already at the first screen). No screen needs its own bespoke goBack handler just to wire a back button.
- `purchase.buy`, `purchase.restore` (and any other `purchase.*`) — calls `actions['purchase.buy'](arg, payload, api)`, etc. Unhandled purchase actions warn and no-op.
- `custom:<name>` or `custom:<name>:<rest>` — calls `actions[<name>](rest, payload, api)`. Unhandled custom actions warn and no-op.
- `app.*` *(v0.4.0)* — see below.

Handlers receive `(arg, payload, api)` — the third argument is the FlowKit
API object (same shape as `useFlowKit()`), so a handler can itself call
`api.dispatch('flow.next')` after finishing async work (e.g. completing a
purchase before advancing the flow).

### `app.*` actions (v0.4.0)

A host handler in `actions` (e.g. `actions['app.checkUpdate']`) always wins;
otherwise FlowKit runs a best-effort built-in via dynamic `require` of the
relevant Expo module — missing module → warns and no-ops, never crashes:

- `app.checkUpdate` — `expo-updates` checkForUpdateAsync → fetchUpdateAsync → reloadAsync ("Yeni Sürümü Çek").
- `app.resetOnboarding` — clears the FlowKit `fk.<appId>.state` cache and recomputes the boot entry (re-triggers onboarding).
- `app.openReview` — opens `appInfo.reviewUrl` via `Linking`.
- `app.contactSupport` — opens `mailto:<appInfo.supportEmail>` via `Linking`.
- `app.openLink:<url>` — opens `<url>` via `Linking`.

All three pass the URL through a scheme allowlist (`https:`, `http:`, `mailto:`,
`tel:`, case-insensitive; no control chars/whitespace) before calling
`Linking.openURL` — a rejected scheme warns and no-ops instead of opening.
This matters because these URLs are server-driven config (studio-editable),
not developer-authored literals.

## `@app.*` — built-in app metadata (v0.4.0)

`FlowKitProvider` assembles a built-in `app` data source at boot, resolved
the same way as `@S`/`@catalog`/`@rc` (no new binding mechanism — `@app` is
just `data.app`):

| Binding | Source |
|---|---|
| `@app.version` | `expo-application` `nativeApplicationVersion`, falling back to `expo-constants` `expoConfig.version` |
| `@app.buildNumber` | `expo-application` `nativeBuildVersion` |
| `@app.isReview` | env `EXPO_PUBLIC_APP_STORE_REVIEW==='1'`, OR `appInfo.reviewVersion === @app.version` |
| `@app.isDev` | `__DEV__` |
| `@app.updateId` / `@app.channel` / `@app.runtimeVersion` | `expo-updates` |
| `@app.configRevision` | the active config's `revision` |

Every field is best-effort — a module that isn't installed, or a field it
doesn't expose, resolves to `null` (never throws, never blanks the whole
binding). Pass the `appInfo` prop to override or supply any field yourself
(e.g. if your app already resolves these natively, or to add
`reviewUrl`/`supportEmail`/`reviewVersion` for the `app.*` actions above).

## `@flag.*` — config feature flags (v0.4.0)

An optional `flags` object on the config (`{ schemaVersion, appId, flags: { hardPaywall: false }, flows, screens }`)
is exposed as `@flag.<name>` in templates and `when` expressions — a
server-driven toggle with no app code change required. Omitted `flags` ->
`@flag.*` resolves to `undefined` (falsy), same as today's behavior.

## SDUI node types

`stack`, `row`, `card`, `divider`, `iconTile`, `text`, `image`, `button`, `choiceGrid`, `progressDots`, `spacer`, `badge`,
`starRating`, `coverArt`, `priceOptionList`, `freqChart`, `knobGauge`, `signalChain`.
An unrecognized node type is skipped (renders nothing) and logs a `console.warn`.

Container primitives (`stack`, `row`, `card`) accept `props: { gap, align: 'start'|'center'|'end', justify, pad, wrap }` and an explicit `style` object that merges last. `stack` is column, `row` is horizontal. `divider` is a thin rule; `iconTile` is a round emoji/image chip (`{ icon, size, iconColor|glyphColor }` — glyph color is styleable as of v0.3.0, was hardcoded before).

Any container node (`stack`, `row`, `card`) may also carry an `action` string *(v0.3.0)*: the whole block becomes pressable (tap-to-advance), calling `onAction(action, payload)` — no separate button needed for a "tap anywhere to continue" screen.

### Tier-2 primitives (v0.2.0)

- **`starRating`** — a row of tappable stars (`props: { max, action, color, emptyColor, value? }`). Tapping star `i` calls `onAction(action, { value: i })`.
- **`coverArt`** — an image (`src`/`uri`) with a deterministic hashed-color + initials fallback when no URL is given (`fallbackText`/`fallbackSeed`, `size`, `radius`).
- **`priceOptionList`** — selectable rows rendered from a `source` array (typically `@rc.offerings`, already resolved to `[{id, title, price, perMonth, badge?}, ...]` by the binding layer). Tapping a row calls `onAction(action, item)`; `selectedId` highlights the matching row.
- **`freqChart`** — static bars, no animation (see v0.3.0 below for dual series).
- **`knobGauge`** — **static approximation.** A labeled circle showing `value` + `label`. Not an animated radial dial — still deferred.

### v0.3.0 additions

- **`freqChart` dual series** — pass `a`/`b` (numeric arrays) instead of/alongside `values`/`bars` to overlay two curves on one shared scale (`aColor`/`bColor` to style each). This is the "theirs vs yours" comparison ToneAdapt's `diff.json` needs. Still static/non-animated — both curves visible at once is the point, not motion. `values`/`bars` (single series) keep working unchanged; `a`/`b` win if both are present. Layout math lives in `freqChartBars()` (`src/styles.js`), unit-tested independent of React Native.
- **`signalChain`** — a horizontal row of icon-tile-like nodes joined by connectors, e.g. guitar → amp → pedal → speaker (`orig_chain` screens). `{ nodes: [{ icon, label?, iconColor? }], connector?, tileSize? }`; `connector` defaults to `→` and is never rendered after the last node. Layout in `signalChainItems()` (`src/styles.js`).
- **`button` size variants** — `variant: 'pill' | 'circle' | 'compact'` (also accepted as `size`). Default (`pill`/omitted) is the existing 52px-minHeight pill; `circle` is a fixed 44×44 round chip (for a small back button); `compact` shrinks the minHeight to 36. Dimensions come from `buttonDims()` (`src/styles.js`), unit-tested.
- **`nav.back` action** — see Actions above.

Deferred to a later release (need heavier native work or additional generic primitives not yet justified by enough screens): `searchInput`/`selectableList`/`stickyDock`/`noneRow` (gear screens), `checkBadge`, `backBar`, `sectionLabel`, `tabContainer`.

### Settings primitives (v0.4.0)

- **`settingsRow`** — `{ icon, label, value?, action?, when? }`. Left icon (emoji/glyph), label, optional right-hand value text and/or a chevron (shown whenever `action` is set); the whole row is tappable when `action` is present.
- **`versionRow`** — zero-config: renders `@app.version`/`@app.buildNumber` as "Version X (build Y)". `buildNumber` missing/null → just "Version X". `version` missing/null → renders nothing (`formatVersionLabel()` in `src/styles.js`, unit-tested).
- **`linkRow`** — `{ label, url }` → tapping dispatches `app.openLink:<url>`.
- **`toggleRow`** — `{ label, flagPath?, value?, action }` → a switch; initial state read from `@flag.<flagPath>` (or `value` if no `flagPath`); flipping it calls `onAction(action, { value })` so the host can persist/override the flag.

All four honor `when` and the existing theme tokens.

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
- Numeric comparison *(v0.4.0)*: `>=`, `>`, `<`, `<=`, e.g. `"@app.buildNumber >= 42"`. A missing/non-numeric resolved value or literal fails open (`true`).

Unprefixed shorthand flags (`@isPro`, `@flay.enabled`) resolve against `@S.*`
(i.e. `@isPro` ≡ `@S.isPro`) since that's where such flags conventionally
live; `@S.*`/`@catalog.*`/`@rc.*`/`@app.*`/`@flag.*` prefixes still address their own source.

**Fail-open semantics:** any unrecognized form, or any error while
evaluating, resolves to `true` — FlowKit would rather show an extra node
than silently hide one due to a template typo.

## Min-app-version gating (v0.4.0)

An optional `minAppVersion` string on the config, combined with a `gate` flow
(same shape as `onboarding`/`paywall`), routes the app to that flow at boot
when `@app.version < minAppVersion` (dot-segment numeric comparison, see
`versionLt()` in `src/appinfo.js`). Fail-open: a missing/unreadable
`@app.version`, a missing/disabled `gate` flow, or no visible screens in it
all skip the gate and boot normally — a malformed config never bricks the app.
Omitting `minAppVersion` leaves today's behavior unchanged.

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
