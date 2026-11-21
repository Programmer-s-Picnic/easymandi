/* Short, opt-in browser speech recognition. Search remains usable by typing. */
(() => {
  'use strict';
  function setupVoiceSearch() {
    const input = document.getElementById('search');
    const button = document.getElementById('voiceSearch');
    const status = document.getElementById('voiceSearchStatus');
    if (!input || !button || !status) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return; // Unsupported browsers keep the ordinary text search.
    button.hidden = false;
    let recognition = null;
    let listening = false;
    const t = (key, vars) => window.EMI18n?.t(key, vars) || key;
    const announce = (message) => { status.textContent = message; };
    const refreshButton = () => {
      const label = t(listening ? 'voiceListening' : 'voiceSearch');
      button.setAttribute('aria-pressed', String(listening));
      button.setAttribute('aria-label', label);
      button.title = label;
    };
    const finish = () => { listening = false; refreshButton(); };
    button.addEventListener('click', () => {
      if (listening) { recognition?.stop(); return; }
      recognition = new Recognition();
      recognition.lang = window.EMI18n?.lang === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const value = event.results?.[0]?.[0]?.transcript?.trim();
        if (!value) return;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        announce(t('voiceSearching', { query: value }));
        input.focus({ preventScroll: true });
      };
      recognition.onerror = (event) => {
        const reason = event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'voiceDenied' : event.error === 'no-speech' ? 'voiceNoMatch' : 'voiceFailed';
        announce(t(reason));
        finish();
      };
      recognition.onend = () => { finish(); };
      try {
        recognition.start(); // User gesture required. Browser asks for microphone access.
        listening = true;
        refreshButton();
        announce(t('voiceListening'));
      } catch (_) { finish(); announce(t('voiceFailed')); }
    });
    window.addEventListener('languagechange', refreshButton);
    refreshButton();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupVoiceSearch, { once: true });
  } else {
    setupVoiceSearch();
  }
})();
