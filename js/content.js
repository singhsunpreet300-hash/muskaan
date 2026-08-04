/* ══════════════════════════════════════════════════
   Bolee — Precomputed content  →  window.Content
   ──────────────────────────────────────────────────
   Loads the generated explanation files on demand.

   All 360 explanations together are far too much to
   parse at boot for a view most visitors open a few
   words in, so each category is a separate file
   injected the first time a word from it is opened.

   Injecting a <script> rather than fetching JSON means
   this also works from file:// — someone who downloads
   the folder and double-clicks index.html still gets
   everything.
   ══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  var BASE = 'data/exp-';
  var pending = {};      // category -> Promise, so parallel opens share one load
  var failed = {};

  function loadCategory(category) {
    if (!category) return Promise.resolve(false);
    if (pending[category]) return pending[category];

    // Already present — either loaded before, or bundled by a future build step.
    var store = global.BOLEE_EXPLANATIONS;
    if (store && store.__loaded && store.__loaded[category]) return Promise.resolve(true);

    pending[category] = new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = BASE + category + '.js';
      script.async = true;

      script.onload = function () {
        var s = global.BOLEE_EXPLANATIONS = global.BOLEE_EXPLANATIONS || {};
        s.__loaded = s.__loaded || {};
        s.__loaded[category] = true;
        resolve(true);
      };

      script.onerror = function () {
        // Missing file is not fatal: the word view simply shows less.
        failed[category] = true;
        delete pending[category];
        resolve(false);
      };

      document.head.appendChild(script);
    });

    return pending[category];
  }

  var Content = {

    /**
     * Explanation for a word, loading its category file if needed.
     * @returns {Promise<object|null>} null when there is nothing to show
     */
    explain: function (word) {
      if (!word || !word.gurmukhi) return Promise.resolve(null);

      // Community-contributed words have no precomputed entry — that is
      // expected, not an error.
      return loadCategory(word.category).then(function () {
        var store = global.BOLEE_EXPLANATIONS || {};
        return store[word.gurmukhi] || null;
      });
    },

    /** Preload a category — used when the learn grid filters to one. */
    preload: loadCategory,

    /** Phrasebook, optionally filtered to one group. */
    phrases: function (groupId) {
      var all = global.BOLEE_PHRASES || [];
      if (!groupId || groupId === 'all') return all.slice();
      return all.filter(function (p) { return p.group === groupId; });
    },

    phraseGroups: function () {
      return (global.BOLEE_PHRASE_GROUPS || []).slice();
    },

    lessons: function () {
      return (global.BOLEE_LESSONS || []).slice();
    },

    lesson: function (id) {
      var all = global.BOLEE_LESSONS || [];
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return null;
    },

    /** Did a category file fail to load? Lets the UI stay quiet about it. */
    failedToLoad: function (category) { return !!failed[category]; }
  };

  global.Content = Content;

})(window);
