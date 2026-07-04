import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/parseAction.js';
test('plain', () => assert.deepEqual(parseAction('flow.next'), { type: 'flow.next', arg: null }));
test('arg', () => assert.deepEqual(parseAction('flow.goto:paywall'), { type: 'flow.goto', arg: 'paywall' }));
test('arg-colon', () => assert.deepEqual(parseAction('custom:x:y'), { type: 'custom', arg: 'x:y' }));
test('bad', () => { assert.equal(parseAction(''), null); assert.equal(parseAction(null), null); });
