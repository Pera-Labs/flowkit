import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadInitialConfig, refreshConfig } from './configChain.js';
import { computeEntry, advance } from './sequencer.js';
import { parseAction } from './parseAction.js';
import { DEFAULT_CONFIG, DEFAULT_SCREENS, DEFAULT_THEME } from './defaults.js';
import { SduiScreen } from './components.js';

const Ctx = createContext(null);
export const useFlowKit = () => useContext(Ctx);
const DEFAULT_ENDPOINT = 'https://appscreenshots.studio/api';

export function FlowKitProvider({ appId, version, endpoint = DEFAULT_ENDPOINT, theme, screens = {}, actions = {}, defaultConfig, children }) {
  const th = { ...DEFAULT_THEME, ...(theme || {}) };
  const registryKeys = Object.keys(screens);
  const hasTemplate = (id) => !!DEFAULT_SCREENS[id];
  const [boot, setBoot] = useState(null); // {config, state, entry}
  const stateRef = useRef({ completed: {} });

  useEffect(() => {
    let dead = false;
    (async () => {
      let fkState = { completed: {} };
      try { const raw = await AsyncStorage.getItem(`fk.${appId}.state`); if (raw) fkState = JSON.parse(raw) || fkState; } catch {}
      const config = await loadInitialConfig({ appId, storage: AsyncStorage, defaultConfig: defaultConfig || DEFAULT_CONFIG(appId) });
      stateRef.current = fkState;
      const entry = computeEntry({ config, state: fkState, registryKeys, hasTemplate });
      if (!dead) setBoot({ config, entry });
      // Arkaplan refresh — sonucu SADECE cache'e yazar, bu run'a uygulamaz.
      refreshConfig({ appId, endpoint, storage: AsyncStorage, currentRevision: config.revision || 0 });
    })();
    return () => { dead = true; };
  }, [appId]);

  const api = useMemo(() => ({
    dispatch: (actionStr, payload) => {
      const a = parseAction(actionStr);
      if (!a) return;
      if (a.type.startsWith('flow.') ) {
        setBoot((b) => {
          if (!b || b.entry.flowId === 'main') return b;
          const r = advance({ config: b.config, state: stateRef.current, at: b.entry, action: actionStr, registryKeys, hasTemplate });
          if (r.stateChanges) {
            stateRef.current = { ...stateRef.current, ...r.stateChanges };
            AsyncStorage.setItem(`fk.${appId}.state`, JSON.stringify(stateRef.current)).catch(() => {});
          }
          return { ...b, entry: r.next };
        });
        return;
      }
      if (a.type === 'nav.goto') {
        if (actions['nav.goto']) actions['nav.goto'](a.arg, payload);
        setBoot((b) => b ? { ...b, entry: { flowId: 'main' } } : b);
        return;
      }
      if (a.type === 'custom') {
        const [name, rest] = a.arg ? [a.arg.split(':')[0], a.arg.split(':').slice(1).join(':')] : [null, null];
        if (name && actions[name]) return actions[name](rest, payload, api); // api: handler flow.next dispatch edebilsin
        return console.warn('[flowkit] no handler for', actionStr);
      }
      const h = actions[a.type]; // purchase.buy, purchase.restore, ...
      if (h) return h(a.arg, payload, api); // api: handler flow.next dispatch edebilsin
      console.warn('[flowkit] no handler for', actionStr);
    },
    config: boot && boot.config, entry: boot && boot.entry,
  }), [boot, appId]);

  if (!boot) return null; // tek frame — cache/default okuma
  const { config, entry } = boot;

  let content = children;
  if (entry.flowId !== 'main') {
    const def = config.screens[entry.screenId] || { kind: 'sdui' };
    if (def.kind === 'native' && screens[def.ref]) {
      const Native = screens[def.ref];
      content = <Native flowkit={api} />;
    } else {
      const template = def.template || DEFAULT_SCREENS[entry.screenId];
      content = <SduiScreen template={template} theme={th} onAction={(s, p) => api.dispatch(s, p)} />;
    }
  }
  return <Ctx.Provider value={api}>{content}</Ctx.Provider>;
}
