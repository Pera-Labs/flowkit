import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { resolveTokens } from './resolve.js';
import { resolveData } from './bind.js';
import { evalWhen } from './when.js';
import { containerStyle, freqChartBars, signalChainItems, buttonDims, formatVersionLabel } from './styles.js';

const EMPTY_DATA = { S: {}, catalog: {}, rc: null, app: {}, flag: {}, _ds: {} };

function kids(children, theme, onAction, data) {
  return (children || []).map((c, i) => <Node key={i} node={c} theme={theme} onAction={onAction} data={data} />);
}

// Deterministic string -> HSL-ish hex color (no external hash lib).
function hashColor(seed) {
  const s = String(seed ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  // fixed sat/light so it always reads as a pleasant flat tile background
  return `hsl(${hue}, 45%, 42%)`;
}

function initialsOf(seed) {
  const s = String(seed ?? '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Own component (not inline in Node's switch) so its useState obeys the
// rules-of-hooks regardless of which SDUI node type renders at a given tree position.
function ToggleRow({ label, initial, textColor, style, onToggle }) {
  const [on, setOn] = useState(initial);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }, style]}>
      <Text style={{ color: textColor, fontSize: 16 }}>{String(label ?? '')}</Text>
      <Switch value={on} onValueChange={(v) => { setOn(v); onToggle(v); }} />
    </View>
  );
}

function StarRating({ max, value, color, emptyColor, onRate }) {
  const [fill, setFill] = useState(Number(value) || 0);
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {Array.from({ length: max }).map((_, i) => {
        const idx = i + 1;
        const filled = idx <= fill;
        return (
          <TouchableOpacity key={idx} activeOpacity={0.7} onPress={() => { setFill(idx); onRate(idx); }}>
            <Text style={{ fontSize: 32, color: filled ? color : emptyColor }}>{filled ? '★' : '☆'}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// A container node (stack/row/card) that carries an `action` becomes
// tap-advance: the whole block is pressable, no bespoke per-screen handler
// needed (e.g. "tap anywhere to continue").
function wrapPressable(content, n, onAction) {
  if (!n.action) return content;
  return <TouchableOpacity activeOpacity={0.85} onPress={() => onAction(n.action, n.payload)}>{content}</TouchableOpacity>;
}

function Node({ node, theme, onAction, data = EMPTY_DATA }) {
  if (!node || typeof node !== 'object') return null;
  if (node.when !== undefined && !evalWhen(node.when, data)) return null;

  // Async-data-source gating: a `source: '@<key>.path'` node renders loadingState/
  // errorState while its dataSource is pending/errored, else null (best-effort).
  if (typeof node.source === 'string' && node.source.startsWith('@')) {
    const dsKey = node.source.slice(1).split('.')[0];
    const status = data && data._ds ? data._ds[dsKey] : undefined;
    if (status === 'pending') {
      return node.loadingState ? <Node node={node.loadingState} theme={theme} onAction={onAction} data={data} /> : null;
    }
    if (status === 'error') {
      return node.errorState ? <Node node={node.errorState} theme={theme} onAction={onAction} data={data} /> : null;
    }
  }

  const n = resolveData(resolveTokens(node, theme), data);
  switch (n.type) {
    case 'stack': {
      // top-level screen stack fills; nested stacks size to content
      const base = containerStyle({ props: n.props, style: n.style });
      return wrapPressable(<View style={[{ flex: 1 }, base]}>{kids(n.children, theme, onAction, data)}</View>, n, onAction);
    }
    case 'row': {
      const base = containerStyle({ row: true, props: { align: 'center', ...(n.props || {}) }, style: n.style });
      return wrapPressable(<View style={base}>{kids(n.children, theme, onAction, data)}</View>, n, onAction);
    }
    case 'card': {
      const base = containerStyle({ props: n.props, style: n.style });
      return wrapPressable((
        <View style={[{ backgroundColor: theme.card, borderRadius: theme.radius, padding: 16 }, base]}>
          {kids(n.children, theme, onAction, data)}
        </View>
      ), n, onAction);
    }
    case 'divider':
      return <View style={[{ height: 1, alignSelf: 'stretch', backgroundColor: theme.text2, opacity: 0.25, marginVertical: 8 }, n.style]} />;
    case 'iconTile': {
      const size = Number(n.size) || 44;
      const glyphColor = n.iconColor || n.glyphColor || n.style?.color;
      return (
        <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: n.style?.backgroundColor || theme.card, alignItems: 'center', justifyContent: 'center' }, n.style]}>
          {n.icon ? (/^https?:\/\//.test(String(n.icon)) ? <Image source={{ uri: n.icon }} style={{ width: size * 0.6, height: size * 0.6 }} /> : <Text style={{ fontSize: size * 0.5, color: glyphColor }}>{String(n.icon)}</Text>) : null}
        </View>
      );
    }
    case 'text': return <Text style={n.style}>{String(n.text ?? '')}</Text>;
    case 'image': return <Image source={{ uri: n.src }} style={[{ width: '100%', height: 220, borderRadius: theme.radius }, n.style]} resizeMode="cover" />;
    case 'spacer': return <View style={{ height: n.size || 16 }} />;
    case 'badge': return <View style={[{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }, n.style]}><Text style={{ color: n.style?.color || theme.accentText, fontWeight: '800', fontSize: 12 }}>{String(n.text ?? '')}</Text></View>;
    case 'progressDots': {
      // clamp total: reject non-numeric/negative/absurdly large SDUI payloads
      const total = Math.max(0, Math.min(50, parseInt(n.total, 10) || 0));
      return (
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === n.at ? theme.accent : theme.text2 }} />
          ))}
        </View>
      );
    }
    case 'button': {
      const variantStyle = buttonDims(n.variant || n.size);
      return (
        <TouchableOpacity onPress={() => onAction(n.action)} activeOpacity={0.85}
          style={[{ minHeight: 52, borderRadius: theme.radius, alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingHorizontal: 20, backgroundColor: n.style?.backgroundColor || theme.accent }, variantStyle, n.style]}>
          {n.icon && !n.label ? <Text style={{ fontSize: 18, color: n.style?.color || theme.accentText }}>{String(n.icon)}</Text>
            : <Text style={{ color: n.style?.color || theme.accentText, fontSize: 17, fontWeight: '700' }}>{String(n.label ?? '')}</Text>}
        </TouchableOpacity>
      );
    }
    case 'choiceGrid': return (
      <ScrollView style={{ maxHeight: 420 }}>
        {(n.items || []).map((it, i) => (
          <TouchableOpacity key={it.id || i} activeOpacity={0.85} onPress={() => onAction(n.action, it)}
            style={{ backgroundColor: theme.card, borderRadius: theme.radius, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {it.emoji ? <Text style={{ fontSize: 24 }}>{it.emoji}</Text> : null}
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{it.label}</Text>
              {it.sub ? <Text style={{ color: theme.text2, fontSize: 13, marginTop: 2 }}>{it.sub}</Text> : null}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
    // --- v0.2.0 tier-2 (see MASTER-SPEC section 2 / README for scope notes) ---
    case 'starRating': {
      const p = n.props || n;
      const max = Math.max(1, Math.min(10, Number(p.max || p.count) || 5));
      return (
        <View style={n.style}>
          <StarRating
            max={max}
            value={p.value}
            color={p.color === '$accent' || !p.color ? theme.accent : p.color}
            emptyColor={p.emptyColor || theme.text2}
            onRate={(i) => onAction(p.action, { value: i })}
          />
        </View>
      );
    }
    case 'coverArt': {
      const size = Number(n.size) || 100;
      const radius = n.radius != null ? Number(n.radius) : theme.radius;
      const uri = n.src || n.uri;
      if (uri) {
        return <Image source={{ uri }} style={[{ width: size, height: size, borderRadius: radius }, n.style]} resizeMode="cover" />;
      }
      const seed = n.fallbackText || n.fallbackSeed || n.title || '';
      return (
        <View style={[{ width: size, height: size, borderRadius: radius, backgroundColor: hashColor(seed), alignItems: 'center', justifyContent: 'center' }, n.style]}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.28 }}>{n.fallbackText || initialsOf(seed)}</Text>
        </View>
      );
    }
    case 'priceOptionList': {
      const items = Array.isArray(n.source) ? n.source : [];
      const selectedId = n.selectedId ?? n.selectedPath;
      return (
        <View style={{ gap: 10 }}>
          {items.map((it, i) => {
            const selected = it && it.id === selectedId;
            return (
              <TouchableOpacity key={it?.id ?? i} activeOpacity={0.85} onPress={() => onAction(n.action, it)}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: theme.card, borderRadius: theme.radius, padding: 14,
                  borderWidth: selected ? 2 : 1, borderColor: selected ? theme.accent : theme.text2,
                }}>
                <View>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>{it?.title}</Text>
                  {it?.perMonth ? <Text style={{ color: theme.text2, fontSize: 12, marginTop: 2 }}>{it.perMonth}</Text> : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {it?.badge ? <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '800' }}>{it.badge}</Text> : null}
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>{it?.price}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }
    case 'freqChart': {
      // Static v0.3.0: single-series bars (v0.2.0 behavior, unchanged), or
      // dual-series (`a`/`b`) overlaid bars for diff.json's "theirs vs yours"
      // comparison — still no animation, just both curves visible at once.
      const height = Number(n.height) || 80;
      const { aHeights, bHeights, dual } = freqChartBars({ values: n.values, bars: n.bars, a: n.a, b: n.b, height });
      const aColor = n.aColor || theme.accent;
      const bColor = n.bColor || theme.text2;
      return (
        <View style={[{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 2 }, n.style]}>
          {aHeights.map((h, i) => (
            // Inner container is ALWAYS flexDirection:'row' (never 'column'),
            // even for the single-series case (where it holds just one bar).
            // Lesson (v0.3.0 regression): a bar View can't have both `flex:1`
            // and an explicit `height` on the SAME axis — Yoga resolves the
            // conflict by growing the flex child to fill the cross axis,
            // which silently flattened every single-series bar to full
            // chart height. With flexDirection:'row', `flex:1` sizes width
            // and `height:h` sizes height independently, so magnitudes render
            // correctly for both single- and dual-series bars.
            <View key={i} style={{ flex: 1, height, justifyContent: 'flex-end', flexDirection: 'row', gap: 1 }}>
              <View style={{ flex: 1, height: h, backgroundColor: aColor, borderRadius: 2, opacity: dual ? 0.85 : 1 }} />
              {dual ? <View style={{ flex: 1, height: bHeights[i] || 2, backgroundColor: bColor, borderRadius: 2, opacity: 0.85 }} /> : null}
            </View>
          ))}
        </View>
      );
    }
    case 'signalChain': {
      // Horizontal row of icon-tile-like nodes joined by connectors, e.g.
      // guitar -> amp -> pedal -> speaker (diff.json's orig_chain screens).
      const items = signalChainItems(n.nodes, n.connector);
      const tileSize = Number(n.tileSize) || 44;
      return (
        <View style={[{ flexDirection: 'row', alignItems: 'center' }, n.style]}>
          {items.map(({ node: tile, connectorAfter }, i) => (
            <React.Fragment key={i}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: tileSize, height: tileSize, borderRadius: tileSize / 2, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: tileSize * 0.5, color: tile?.iconColor || tile?.glyphColor }}>{String(tile?.icon ?? '')}</Text>
                </View>
                {tile?.label ? <Text style={{ color: theme.text2, fontSize: 11, marginTop: 4 }}>{String(tile.label)}</Text> : null}
              </View>
              {connectorAfter ? <Text style={{ color: theme.text2, fontSize: 16, marginHorizontal: 6 }}>{connectorAfter}</Text> : null}
            </React.Fragment>
          ))}
        </View>
      );
    }
    case 'knobGauge': {
      // Static v0.2.0 approximation: a labeled circle, not an animated radial dial.
      const size = Number(n.size) || 52;
      const value = n.value;
      return (
        <View style={{ alignItems: 'center' }}>
          <View style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: theme.accent, alignItems: 'center', justifyContent: 'center' }, n.style]}>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: size * 0.28 }}>{String(value ?? '')}</Text>
          </View>
          {n.label ? <Text style={{ color: theme.text2, fontSize: 11, marginTop: 4 }}>{String(n.label)}</Text> : null}
        </View>
      );
    }
    // --- v0.4.0 settings primitives ---
    case 'settingsRow': {
      // { icon, label, value?, action?, when? } — icon left, label + optional
      // right-hand value/chevron, whole row tappable when `action` is set.
      const row = (
        <View style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 }, n.style]}>
          {n.icon ? <Text style={{ fontSize: 20, color: n.iconColor || theme.text }}>{String(n.icon)}</Text> : null}
          <Text style={{ flex: 1, color: theme.text, fontSize: 16 }}>{String(n.label ?? '')}</Text>
          {n.value != null ? <Text style={{ color: theme.text2, fontSize: 14 }}>{String(n.value)}</Text> : null}
          {n.action ? <Text style={{ color: theme.text2, fontSize: 18 }}>{'›'}</Text> : null}
        </View>
      );
      return n.action ? <TouchableOpacity activeOpacity={0.7} onPress={() => onAction(n.action, n.payload)}>{row}</TouchableOpacity> : row;
    }
    case 'versionRow': {
      // Zero-config — reads @app.version/@app.buildNumber straight from data,
      // never from resolved template props (n.text is not user-authorable here).
      const label = formatVersionLabel(data && data.app);
      if (!label) return null;
      return (
        <View style={[{ paddingVertical: 14 }, n.style]}>
          <Text style={{ color: theme.text2, fontSize: 13 }}>{label}</Text>
        </View>
      );
    }
    case 'linkRow': {
      // { label, url } -> app.openLink:<url>
      return (
        <TouchableOpacity activeOpacity={0.7} onPress={() => onAction(`app.openLink:${n.url}`)}
          style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }, n.style]}>
          <Text style={{ color: theme.text, fontSize: 16 }}>{String(n.label ?? '')}</Text>
          <Text style={{ color: theme.text2, fontSize: 18 }}>{'›'}</Text>
        </TouchableOpacity>
      );
    }
    case 'toggleRow': {
      // { label, flagPath, action } — initial value read from @flag.<flagPath>
      // (studio default); user taps flip local render state and call the
      // host's action with the new value so it can persist/override.
      const p = n.props || n;
      const initial = !!(p.flagPath ? (data && data.flag ? data.flag[p.flagPath] : undefined) : p.value);
      return (
        <ToggleRow label={p.label} initial={initial} textColor={theme.text} style={n.style}
          onToggle={(v) => onAction(p.action, { value: v })} />
      );
    }
    default:
      console.warn('[flowkit] unknown node type:', n.type);
      return null;
  }
}

export function SduiScreen({ template, theme, onAction, data = EMPTY_DATA }) {
  return <View style={{ flex: 1, backgroundColor: theme.bg }}><Node node={template} theme={theme} onAction={onAction} data={data} /></View>;
}

// v0.5.0 — bottom tab bar for `flows.main.type === 'tabs'`. `tabs` is an
// ordered list of { id, label?, icon? } (icon/label sourced from the
// screen's config meta by the caller). `active` is the current tab id;
// `onTab(id)` fires on tap. Renders nothing but its own children when there
// are 0 or 1 tabs — never renders a bar for a single-screen "shell".
export function TabShell({ tabs = [], active, onTab, theme, children }) {
  const th = theme || {};
  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <View style={{ flex: 1 }}>{children}</View>
      {tabs.length > 1 ? (
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: th.text2, backgroundColor: th.card }}>
          {tabs.map((t) => {
            const isActive = t.id === active;
            return (
              <TouchableOpacity key={t.id} activeOpacity={0.7} onPress={() => onTab(t.id)}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
                {t.icon ? <Text style={{ fontSize: 20, color: isActive ? th.accent : th.text2 }}>{String(t.icon)}</Text> : null}
                <Text style={{ fontSize: 11, marginTop: 2, color: isActive ? th.accent : th.text2, fontWeight: isActive ? '700' : '400' }}>
                  {String(t.label ?? t.id ?? '')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
