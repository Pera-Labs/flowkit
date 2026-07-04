export const DEFAULT_THEME = {
  bg: '#0A0A0C', card: '#16161A', text: '#FFFFFF', text2: 'rgba(255,255,255,0.65)',
  accent: '#6E64FF', accentText: '#FFFFFF', radius: 16,
};

const btn = (label, action) => ({ type: 'button', label, action, style: { backgroundColor: '$accent', color: '$accentText' } });

export const DEFAULT_SCREENS = {
  'ob-welcome': { type: 'stack', props: { pad: 24, justify: 'center' }, children: [
    { type: 'text', text: 'Welcome 👋', style: { fontSize: 34, fontWeight: '800', color: '$text' } },
    { type: 'text', text: 'Let us show you around in a few quick steps.', style: { fontSize: 17, color: '$text2', marginTop: 12 } },
    { type: 'spacer', size: 32 },
    { type: 'progressDots', total: 3, at: 0 },
    btn('Continue', 'flow.next'),
    { type: 'button', label: 'Skip', action: 'flow.skip', style: { backgroundColor: 'transparent', color: '$text2' } },
  ]},
  'ob-value': { type: 'stack', props: { pad: 24, justify: 'center' }, children: [
    { type: 'text', text: 'Made for you', style: { fontSize: 30, fontWeight: '800', color: '$text' } },
    { type: 'text', text: 'Everything adapts to how you use the app.', style: { fontSize: 17, color: '$text2', marginTop: 12 } },
    { type: 'spacer', size: 32 }, { type: 'progressDots', total: 3, at: 1 }, btn('Continue', 'flow.next'),
  ]},
  'ob-start': { type: 'stack', props: { pad: 24, justify: 'center' }, children: [
    { type: 'text', text: "You're all set", style: { fontSize: 30, fontWeight: '800', color: '$text' } },
    { type: 'spacer', size: 32 }, { type: 'progressDots', total: 3, at: 2 }, btn('Get started', 'flow.next'),
  ]},
  'pw-main': { type: 'stack', props: { pad: 24, justify: 'center' }, children: [
    { type: 'badge', text: 'PRO', style: { backgroundColor: '$accent', color: '$accentText' } },
    { type: 'text', text: 'Unlock everything', style: { fontSize: 32, fontWeight: '800', color: '$text', marginTop: 12 } },
    { type: 'text', text: 'Full access. Cancel anytime.', style: { fontSize: 16, color: '$text2', marginTop: 8 } },
    { type: 'spacer', size: 24 },
    btn('Continue', 'purchase.buy:default'),
    { type: 'button', label: 'Restore purchases', action: 'purchase.restore', style: { backgroundColor: 'transparent', color: '$text2' } },
    { type: 'button', label: 'Not now', action: 'flow.skip', style: { backgroundColor: 'transparent', color: '$text2' } },
  ]},
};

export const DEFAULT_CONFIG = (appId) => ({
  schemaVersion: 1, appId, revision: 0,
  flows: {
    onboarding: { enabled: true, screens: ['ob-welcome', 'ob-value', 'ob-start'], endAction: 'flow.goto:paywall' },
    paywall: { enabled: true, screens: ['pw-main'], trigger: 'post-onboarding' },
    main: { enabled: true, type: 'app', screens: [] },
  },
  screens: {
    'ob-welcome': { kind: 'sdui' }, 'ob-value': { kind: 'sdui' }, 'ob-start': { kind: 'sdui' }, 'pw-main': { kind: 'sdui' },
  },
});
