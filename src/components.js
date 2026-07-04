import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { resolveTokens } from './resolve.js';

function Node({ node, theme, onAction }) {
  if (!node || typeof node !== 'object') return null;
  const n = resolveTokens(node, theme);
  switch (n.type) {
    case 'stack': {
      const p = n.props || {};
      return (
        <View style={{ flex: 1, padding: p.pad ?? 0, justifyContent: p.justify === 'center' ? 'center' : 'flex-start' }}>
          {(n.children || []).map((c, i) => <Node key={i} node={c} theme={theme} onAction={onAction} />)}
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
    default:
      console.warn('[flowkit] unknown node type:', n.type);
      return null;
  }
}

export function SduiScreen({ template, theme, onAction }) {
  return <View style={{ flex: 1, backgroundColor: theme.bg }}><Node node={template} theme={theme} onAction={onAction} /></View>;
}
