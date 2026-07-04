import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadInitialConfig, refreshConfig } from './configChain.js';
import { computeEntry, advance, visibleScreens } from './sequencer.js';
import { parseAction } from './parseAction.js';
import { DEFAULT_CONFIG, DEFAULT_SCREENS, DEFAULT_THEME } from './defaults.js';
import { SduiScreen } from './components.js';
import { assembleAppInfo, versionLt, safeExternalUrl } from './appinfo.js';

const Ctx = createContext(null);
export const useFlowKit = () => useContext(Ctx);
const DEFAULT_ENDPOINT = 'https://appscreenshots.studio/api';

// Best-effort read of optional native modules (expo-application, expo-constants,
// expo-updates) + __DEV__. Every module is peerOptional — a bare/managed app
// missing one simply yields `undefined` for that field, never throws. Not unit
// tested with node:test (needs a RN/Metro `require` runtime); esbuild-checked
// only, same as the rest of components.js/FlowKitProvider.js.
function readAppSources() {
  const out = {};
  try {
    // eslint-disable-next-line global-require
    const ea = require('expo-application');
    if (ea && ea.nativeApplicationVersion != null) out.version = ea.nativeApplicationVersion;
    if (ea && ea.nativeBuildVersion != null) out.buildNumber = ea.nativeBuildVersion;
  } catch {}
  try {
    // eslint-disable-next-line global-require
    const mod = require('expo-constants');
    const ec = (mod && mod.default) || mod;
    const cfgVersion = ec && ec.expoConfig && ec.expoConfig.version;
    if (out.version === undefined && cfgVersion != null) out.version = cfgVersion;
  } catch {}
  try {
    // eslint-disable-next-line global-require
    const mod = require('expo-updates');
    const eu = (mod && mod.default) || mod;
    if (eu) {
      out.updateId = eu.updateId ?? null;
      out.channel = eu.channel ?? null;
      out.runtimeVersion = eu.runtimeVersion ?? null;
    }
  } catch {}
  try { out.isDev = typeof __DEV__ !== 'undefined' ? !!__DEV__ : false; } catch { out.isDev = false; }
  try { out.isReview = typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_APP_STORE_REVIEW === '1'; } catch {}
  return out;
}

// Best-effort dynamic-require action for expo-updates' checkForUpdate/fetch/reload
// dance ("Yeni Sürümü Çek" in ToneAdapt). No-op + warn if expo-updates is absent.
async function builtinCheckUpdate() {
  try {
    // eslint-disable-next-line global-require
    const mod = require('expo-updates');
    const eu = (mod && mod.default) || mod;
    if (!eu || !eu.checkForUpdateAsync) return console.warn('[flowkit] app.checkUpdate: expo-updates not available');
    const check = await eu.checkForUpdateAsync();
    if (!check || !check.isAvailable) return;
    await eu.fetchUpdateAsync();
    await eu.reloadAsync();
  } catch (err) {
    console.warn('[flowkit] app.checkUpdate failed:', err && err.message);
  }
}

function builtinOpenLink(url) {
  if (!url) return;
  const safe = safeExternalUrl(url);
  if (!safe) return console.warn('[flowkit] app.openLink: rejected URL scheme', url);
  try {
    // eslint-disable-next-line global-require
    const { Linking } = require('react-native');
    Linking.openURL(safe).catch((err) => console.warn('[flowkit] app.openLink failed:', err && err.message));
  } catch (err) {
    console.warn('[flowkit] app.openLink: react-native Linking not available', err && err.message);
  }
}

export function FlowKitProvider({ appId, version, endpoint = DEFAULT_ENDPOINT, theme, screens = {}, actions = {}, defaultConfig, state, catalogs, dataSources, appInfo, children }) {
  const th = { ...DEFAULT_THEME, ...(theme || {}) };
  const actionsRef = useRef(actions);
  const screensRef = useRef(screens);
  actionsRef.current = actions;
  screensRef.current = screens;
  const registryKeys = Object.keys(screens);
  const hasTemplate = (id) => !!DEFAULT_SCREENS[id];
  const [boot, setBoot] = useState(null); // {config, state, entry}
  const stateRef = useRef({ completed: {} });
  // Async dataSources (e.g. RevenueCat offerings): { [key]: value|null }, plus
  // per-key status so SduiScreen can gate loadingState/errorState sub-templates.
  const [dsData, setDsData] = useState({});
  const [dsStatus, setDsStatus] = useState({});
  // Latest dataSources kept in a ref so the resolver effect (below) can read
  // the current value without depending on the object's identity — a host
  // re-render that recreates an inline `dataSources={{...}}` literal must
  // not re-fire resolvers.
  const dsRef = useRef(dataSources);
  dsRef.current = dataSources;
  const appInfoRef = useRef(appInfo);
  appInfoRef.current = appInfo;
  // Native-module reads happen once per mount — they don't change across a session.
  const sources = useMemo(() => readAppSources(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let dead = false;
    (async () => {
      let fkState = { completed: {} };
      try { const raw = await AsyncStorage.getItem(`fk.${appId}.state`); if (raw) fkState = JSON.parse(raw) || fkState; } catch {}
      const config = await loadInitialConfig({ appId, storage: AsyncStorage, defaultConfig: defaultConfig || DEFAULT_CONFIG(appId) });
      stateRef.current = fkState;
      let entry = computeEntry({ config, state: fkState, registryKeys, hasTemplate });
      // v0.4.0: minAppVersion gating — server-driven "please update" flow, fail-open
      // (missing/unreadable version, missing `gate` flow, or no visible gate screens
      // -> proceed as normal, never blocks the app on a malformed config).
      if (config.minAppVersion && config.flows && config.flows.gate && config.flows.gate.enabled) {
        const info = assembleAppInfo(sources, appInfoRef.current);
        if (versionLt(info.version, config.minAppVersion)) {
          const vis = visibleScreens(config, 'gate', registryKeys, hasTemplate);
          if (vis.length) entry = { flowId: 'gate', screenId: vis[0], index: 0 };
        }
      }
      if (!dead) setBoot({ config, entry });
      // Background refresh — writes ONLY to cache; applied on next cold start, never mid-run.
      refreshConfig({ appId, endpoint, storage: AsyncStorage, currentRevision: config.revision || 0 });
    })();
    return () => { dead = true; };
  }, [appId]);

  // Resolve each registered dataSource once on boot. A rejected resolver
  // produces an error state for that key, never a crash.
  useEffect(() => {
    let dead = false;
    const entries = Object.entries(dsRef.current || {});
    if (entries.length === 0) return undefined;
    setDsStatus((s) => {
      const next = { ...s };
      for (const [key] of entries) next[key] = 'pending';
      return next;
    });
    entries.forEach(async ([key, ds]) => {
      try {
        const value = await ds.resolver();
        if (dead) return;
        setDsData((d) => ({ ...d, [key]: value }));
        setDsStatus((s) => ({ ...s, [key]: 'ready' }));
      } catch (err) {
        if (dead) return;
        console.warn('[flowkit] dataSource failed:', key, err && err.message);
        setDsStatus((s) => ({ ...s, [key]: 'error' }));
      }
    });
    return () => { dead = true; };
  }, [appId]);

  const appData = useMemo(() => {
    const src = { ...sources, configRevision: (boot && boot.config && boot.config.revision != null) ? boot.config.revision : null };
    return assembleAppInfo(src, appInfoRef.current);
  }, [sources, appInfo, boot && boot.config && boot.config.revision]);

  const flagData = useMemo(() => (boot && boot.config && boot.config.flags) || {}, [boot && boot.config]);

  const data = useMemo(() => ({
    S: state ?? {},
    catalog: catalogs ?? {},
    rc: dsData.rc ?? null,
    app: appData,
    flag: flagData,
    _ds: dsStatus,
  }), [state, catalogs, dsData, dsStatus, appData, flagData]);

  const api = useMemo(() => ({
    dispatch: (actionStr, payload) => {
      const a = parseAction(actionStr);
      if (!a) return;
      if (a.type.startsWith('flow.') ) {
        setBoot((b) => {
          if (!b || b.entry.flowId === 'main') return b;
          const r = advance({ config: b.config, state: stateRef.current, at: b.entry, action: actionStr, registryKeys: Object.keys(screensRef.current), hasTemplate });
          if (r.stateChanges) {
            stateRef.current = { ...stateRef.current, ...r.stateChanges };
            AsyncStorage.setItem(`fk.${appId}.state`, JSON.stringify(stateRef.current)).catch(() => {});
          }
          return { ...b, entry: r.next };
        });
        return;
      }
      if (a.type === 'nav.back') {
        // Prefer a host-registered handler (e.g. custom native-stack pop); else
        // fall back to stepping one screen back within the current flow, or
        // to `main` if already at the first screen — no screen ever needs
        // its own bespoke goBack handler just to wire a back button.
        if (actionsRef.current['nav.back']) return actionsRef.current['nav.back'](a.arg, payload, api);
        setBoot((b) => {
          if (!b || b.entry.flowId === 'main') return b;
          const r = advance({ config: b.config, state: stateRef.current, at: b.entry, action: 'flow.back', registryKeys: Object.keys(screensRef.current), hasTemplate });
          return { ...b, entry: r.next };
        });
        return;
      }
      if (a.type === 'nav.goto') {
        if (actionsRef.current['nav.goto']) actionsRef.current['nav.goto'](a.arg, payload);
        setBoot((b) => b ? { ...b, entry: { flowId: 'main' } } : b);
        return;
      }
      if (a.type.startsWith('app.')) {
        // Host handler always wins; otherwise SDK best-effort built-in, fail-safe (never throws/crashes).
        const custom = actionsRef.current[a.type];
        if (custom) return custom(a.arg, payload, api);
        if (a.type === 'app.checkUpdate') { builtinCheckUpdate(); return; }
        if (a.type === 'app.resetOnboarding') {
          stateRef.current = { completed: {} };
          AsyncStorage.setItem(`fk.${appId}.state`, JSON.stringify(stateRef.current)).catch(() => {});
          setBoot((b) => b ? { ...b, entry: computeEntry({ config: b.config, state: stateRef.current, registryKeys: Object.keys(screensRef.current), hasTemplate }) } : b);
          return;
        }
        if (a.type === 'app.openReview') return builtinOpenLink(appInfoRef.current && appInfoRef.current.reviewUrl);
        if (a.type === 'app.contactSupport') {
          const email = appInfoRef.current && appInfoRef.current.supportEmail;
          return builtinOpenLink(email ? `mailto:${email}` : null);
        }
        if (a.type === 'app.openLink') return builtinOpenLink(a.arg);
        console.warn('[flowkit] no handler for', actionStr);
        return;
      }
      if (a.type === 'custom') {
        const [name, rest] = a.arg ? [a.arg.split(':')[0], a.arg.split(':').slice(1).join(':')] : [null, null];
        if (name && actionsRef.current[name]) return actionsRef.current[name](rest, payload, api); // api: lets the handler dispatch flow.next
        return console.warn('[flowkit] no handler for', actionStr);
      }
      const h = actionsRef.current[a.type]; // purchase.buy, purchase.restore, ...
      if (h) return h(a.arg, payload, api); // api: lets the handler dispatch flow.next
      console.warn('[flowkit] no handler for', actionStr);
    },
    config: boot && boot.config, entry: boot && boot.entry,
  }), [boot, appId]);

  if (!boot) return null; // single frame — reading cache/default
  const { config, entry } = boot;

  let content = children;
  if (entry.flowId !== 'main') {
    const def = config.screens[entry.screenId] || { kind: 'sdui' };
    if (def.kind === 'native' && screens[def.ref]) {
      const Native = screens[def.ref];
      content = <Native flowkit={api} />;
    } else {
      const template = def.template || DEFAULT_SCREENS[entry.screenId];
      content = <SduiScreen template={template} theme={th} onAction={(s, p) => api.dispatch(s, p)} data={data} />;
    }
  }
  return <Ctx.Provider value={api}>{content}</Ctx.Provider>;
}
