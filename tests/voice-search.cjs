'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('web/voice-search.js', 'utf8');

function harness(supported = true) {
  const events = [];
  const listeners = {};
  const input = {
    value: '',
    dispatchEvent(e) { events.push(e.type); },
    focus() {},
  };
  const button = {
    hidden: true,
    attributes: { 'aria-label': 'Search by voice' },
    addEventListener(type, handler) { this[type] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
  };
  const status = { textContent: '' };
  let speech;
  class Recognizer {
    constructor() { speech = this; }
    start() { this.started = true; }
    stop() { this.stopped = true; this.onend?.(); }
  }
  const i18n = { lang: 'en', t: (key, vals) => vals?.query ? vals.query : key };
  const window = {
    EMI18n: i18n,
    addEventListener(type, handler) { listeners[type] = handler; },
  };
  if (supported) window.SpeechRecognition = Recognizer;
  const document = {
    readyState: 'complete',
    getElementById(id) { return { search: input, voiceSearch: button, voiceSearchStatus: status }[id]; },
  };
  vm.runInNewContext(source, { document, window, Event: class { constructor(type) { this.type = type; } } });
  return { input, button, status, events, i18n, listeners, get speech() { return speech; } };
}

const h = harness();
assert.equal(h.button.hidden, false);
h.button.click();
assert.equal(h.speech.started, true);
assert.equal(h.speech.lang, 'en-IN');
assert.equal(h.button.attributes['aria-pressed'], 'true');
h.speech.onresult({ results: [[{ transcript: '  potatoes  ' }]] });
assert.equal(h.input.value, 'potatoes');
assert.deepEqual(h.events, ['input']);
h.button.click();
assert.equal(h.speech.stopped, true);
assert.equal(h.button.attributes['aria-pressed'], 'false');
h.i18n.lang = 'hi';
h.listeners.languagechange();
h.button.click();
assert.equal(h.speech.lang, 'hi-IN');
h.speech.onresult({ results: [[{ transcript: ' आलू ' }]] });
assert.equal(h.input.value, 'आलू');
assert.equal(h.events.length, 2);
assert.equal(harness(false).button.hidden, true);
console.log('Customer browser voice-search tests passed.');
