import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { resolveTokens } from './resolve.js';
import { resolveData } from './bind.js';
import { evalWhen } from './when.js';
import { containerStyle } from './styles.js';

const EMPTY_DATA = { S: {}, catalog: {}, rc: null, _ds: {} };

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
      return <View style={[{ flex: 1 }, base]}>{kids(n.children, theme, onAction, data)}</View>;
    }
    case 'row': {
      const base = containerStyle({ row: true, props: { align: 'center', ...(n.props || {}) }, style: n.style });
      return <View style={base}>{kids(n.children, theme, onAction, data)}</View>;
    }
    case 'card': {
      const base = containerStyle({ props: n.props, style: n.style });
      return (
        <View style={[{ backgroundColor: theme.card, borderRadius: theme.radius, padding: 16 }, base]}>
          {kids(n.children, theme, onAction, data)}
        </View>
      );
    }
    case 'divider':
      return <View style={[{ height: 1, alignSelf: 'stretch', backgroundColor: theme.text2, opacity: 0.25, marginVertical: 8 }, n.style]} />;
    case 'iconTile': {
      const size = Number(n.size) || 44;
      return (
        <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: n.style?.backgroundColor || theme.card, alignItems: 'center', justifyContent: 'center' }, n.style]}>
          {n.icon ? (/^https?:\/\//.test(String(n.icon)) ? <Image source={{ uri: n.icon }} style={{ width: size * 0.6, height: size * 0.6 }} /> : <Text style={{ fontSize: size * 0.5 }}>{String(n.icon)}</Text>) : null}
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
    case 'button': return (
      <TouchableOpacity onPress={() => onAction(n.action)} activeOpacity={0.85}
        style={[{ minHeight: 52, borderRadius: theme.radius, alignItems: 'center', justifyContent: 'center', marginTop: 10, backgroundColor: n.style?.backgroundColor || theme.accent }]}>
        <Text style={{ color: n.style?.color || theme.accentText, fontSize: 17, fontWeight: '700' }}>{String(n.label ?? '')}</Text>
      </TouchableOpacity>
    );
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
      // Static v0.2.0 approximation: a row of bars sized from a numeric array.
      // No animation/interaction — see README for the deferred animated version.
      const values = Array.isArray(n.values) ? n.values : Array.isArray(n.bars) ? n.bars : [];
      const max = Math.max(1, ...values.map((v) => Number(v) || 0));
      const height = Number(n.height) || 80;
      return (
        <View style={[{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 2 }, n.style]}>
          {values.map((v, i) => {
            const h = Math.max(2, (Math.max(0, Number(v) || 0) / max) * height);
            return <View key={i} style={{ flex: 1, height: h, backgroundColor: theme.accent, borderRadius: 2 }} />;
          })}
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
    default:
      console.warn('[flowkit] unknown node type:', n.type);
      return null;
  }
}

export function SduiScreen({ template, theme, onAction, data = EMPTY_DATA }) {
  return <View style={{ flex: 1, backgroundColor: theme.bg }}><Node node={template} theme={theme} onAction={onAction} data={data} /></View>;
}
