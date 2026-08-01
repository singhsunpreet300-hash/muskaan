/* ══════════════════════════════════════════════════
   Bolee — App Controller  →  window.App
   ──────────────────────────────────────────────────
   Hash router + view rendering + event wiring.
   All data access goes through Store / Practice /
   Contribute / Verify / AiTutor — this file owns the
   DOM and nothing else.
   ══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  var VIEWS = ['learn', 'practice', 'contribute', 'review', 'tutor', 'progress'];
  var KIDS_BLOCKED = ['contribute', 'review'];

  var state = {
    settings: null,
    profile: null,
    filter: { category: 'all', tier: 'all', search: '' },
    session: null,
    chat: [],
    recording: null,
    streaming: false
  };

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(message, kind) {
    var el = $('#toast');
    el.textContent = message;
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.hidden = true; }, 3200);
  }

  function isKids() { return state.settings && state.settings.mode === 'kids'; }

  /* ══════════════════════════════════════════════════
     Boot
     ══════════════════════════════════════════════════ */

  function boot() {
    if (!global.Store.storageAvailable()) {
      toast('Private browsing: your words will be lost when you close this tab.', 'warn');
    }

    return global.Store.init()
      .then(function () {
        return Promise.all([global.Store.getSettings(), global.Store.getProfile()]);
      })
      .then(function (parts) {
        state.settings = parts[0];
        state.profile = parts[1];
        applyMode();
        applyTheme();
        buildStaticControls();
        wireEvents();

        window.addEventListener('hashchange', route);
        route();
        refreshBadges();

        // Voices can take a second to arrive — and never arrive at all on a
        // browser that ships none. They're only needed for playback and the
        // settings dropdown, so don't hold first paint hostage to them.
        global.SpeechEngine.loadVoices().then(populateVoices);
      })
      .catch(function (err) {
        console.error('[App] boot failed', err);
        toast('Something went wrong starting the app.', 'bad');
      });
  }

  /* ══════════════════════════════════════════════════
     Chrome: mode, theme, nav
     ══════════════════════════════════════════════════ */

  function applyMode() {
    var kids = isKids();
    document.documentElement.setAttribute('data-mode', kids ? 'kids' : 'adult');
    $('#mode-icon').textContent = kids ? '🧒' : '🧑';
    $('#btn-mode').title = kids ? 'Switch to adult mode' : 'Switch to kids mode';

    // Contribution and review are adult responsibilities — hide, don't just style.
    $$('[data-adult-only]').forEach(function (el) { el.hidden = kids; });
    $('#rep-chip').hidden = kids || !state.profile;
  }

  function applyTheme() {
    var theme = state.settings.theme || 'auto';
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }

  function refreshBadges() {
    if (state.profile) $('#rep-value').textContent = state.profile.reputation || 0;
    if (isKids()) { $('#review-badge').hidden = true; return; }

    global.Verify.queue().then(function (queue) {
      var badge = $('#review-badge');
      badge.textContent = queue.length;
      badge.hidden = queue.length === 0;
    });
  }

  /* ══════════════════════════════════════════════════
     Router
     ══════════════════════════════════════════════════ */

  function currentRoute() {
    var raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return VIEWS.indexOf(raw) !== -1 ? raw : 'learn';
  }

  function route() {
    var name = currentRoute();

    // A child following an old link shouldn't land in the review queue.
    if (isKids() && KIDS_BLOCKED.indexOf(name) !== -1) {
      location.hash = '#/learn';
      return;
    }

    VIEWS.forEach(function (v) { $('#view-' + v).hidden = v !== name; });
    $$('.app-nav a').forEach(function (a) {
      a.classList.toggle('active', a.dataset.nav === name);
    });
    window.scrollTo(0, 0);

    var renderers = {
      learn: renderLearn,
      practice: renderPracticeSetup,
      contribute: renderContribute,
      review: renderReview,
      tutor: renderTutor,
      progress: renderProgress
    };
    if (renderers[name]) renderers[name]();
  }

  /* ══════════════════════════════════════════════════
     Static controls (chips, selects) built from data
     ══════════════════════════════════════════════════ */

  function buildStaticControls() {
    var cats = global.VOCAB_CATEGORIES;

    // Learn: category chips
    var chips = ['<button class="chip active" data-cat="all">All</button>'];
    cats.forEach(function (c) {
      chips.push('<button class="chip" data-cat="' + c.id + '">' +
        '<span aria-hidden="true">' + c.emoji + '</span> ' + esc(c.label) + '</button>');
    });
    $('#category-chips').innerHTML = chips.join('');

    // Learn: tier filter
    $('#tier-filter').innerHTML =
      '<button class="pill active" data-tier="all">All levels</button>' +
      global.VOCAB_TIERS.map(function (t) {
        return '<button class="pill" data-tier="' + t.id + '" title="' + esc(t.hint) + '">' +
          esc(t.label) + '</button>';
      }).join('');

    // Category selects
    var catOptions = cats.map(function (c) {
      return '<option value="' + c.id + '">' + c.emoji + ' ' + esc(c.label) + '</option>';
    }).join('');
    $('#practice-category').innerHTML = '<option value="all">All categories</option>' + catOptions;
    $('#c-category').innerHTML = catOptions;

    // Dialect selects
    var dialects = global.VOCAB_DIALECTS;
    $('#c-dialect').innerHTML = dialects.map(function (d) {
      return '<option value="' + d.id + '">' + esc(d.label) + '</option>';
    }).join('');
    $('#s-dialect').innerHTML = dialects.map(function (d) {
      return '<option value="' + d.id + '">' + esc(d.label) + '</option>';
    }).join('');
  }

  /* ══════════════════════════════════════════════════
     LEARN
     ══════════════════════════════════════════════════ */

  function renderLearn() {
    var filter = {
      status: 'verified',
      category: state.filter.category,
      tier: state.filter.tier
    };
    if (isKids()) filter.maxTier = 2;

    global.Store.getWords(filter).then(function (words) {
      var q = state.filter.search.trim().toLowerCase();
      if (q) {
        words = words.filter(function (w) {
          return w.gurmukhi.indexOf(q) !== -1 ||
                 w.latin.toLowerCase().indexOf(q) !== -1 ||
                 w.meaning.toLowerCase().indexOf(q) !== -1;
        });
      }

      $('#learn-count').textContent = words.length + (words.length === 1 ? ' word' : ' words');
      $('#learn-empty').hidden = words.length > 0;

      $('#word-grid').innerHTML = words.map(function (w) {
        return '<button class="word-card" data-word="' + esc(w.id) + '">' +
          '<span class="wc-emoji" aria-hidden="true">' + esc(w.emoji) + '</span>' +
          '<span class="wc-gurmukhi" lang="pa">' + esc(w.gurmukhi) + '</span>' +
          (state.settings.showLatin ? '<span class="wc-latin">' + esc(w.latin) + '</span>' : '') +
          '<span class="wc-meaning">' + esc(w.meaning) + '</span>' +
          (w.source === 'community'
            ? '<span class="wc-tag" title="Added by a community member">community</span>' : '') +
          '</button>';
      }).join('');
    });
  }

  function openWord(wordId) {
    global.Store.getWord(wordId).then(function (w) {
      if (!w) return;
      var latin = state.settings.showLatin
        ? '<p class="wm-latin">' + esc(w.latin) + '</p>' : '';

      var example = w.example && w.example.gurmukhi
        ? '<div class="wm-example">' +
            '<p lang="pa">' + esc(w.example.gurmukhi) + '</p>' +
            (state.settings.showLatin && w.example.latin
              ? '<p class="wm-latin">' + esc(w.example.latin) + '</p>' : '') +
            '<button class="btn btn-ghost btn-sm" data-speak="' + esc(w.example.gurmukhi) + '">🔊 Hear sentence</button>' +
          '</div>'
        : '';

      var credit = w.source === 'community'
        ? '<p class="wm-credit">Added by ' + esc(w.contributorName || 'a community member') + '</p>' : '';

      $('#word-modal-body').innerHTML =
        '<div class="wm-head">' +
          '<span class="wm-emoji" aria-hidden="true">' + esc(w.emoji) + '</span>' +
          '<h2 id="wm-gurmukhi" lang="pa">' + esc(w.gurmukhi) + '</h2>' +
          latin +
          '<p class="wm-meaning">' + esc(w.meaning) + '</p>' +
          '<p class="wm-meta">' + esc(w.pos) + ' · ' + esc(w.category) +
            ' · ' + esc(dialectLabel(w.dialect)) + ' · ' + esc(tierLabel(w.tier)) + '</p>' +
        '</div>' +
        '<div class="wm-actions">' +
          '<button class="btn btn-primary" data-speak="' + esc(w.gurmukhi) + '">🔊 Hear it</button>' +
          (w.hasAudio ? '<button class="btn btn-ghost" data-play-clip="' + esc(w.id) + '">🎙 Speaker recording</button>' : '') +
          (isKids() ? '' : '<button class="btn btn-ghost" data-explain="' + esc(w.id) + '">✨ Ask the tutor</button>') +
        '</div>' +
        example +
        (w.notes ? '<p class="wm-notes">' + esc(w.notes) + '</p>' : '') +
        credit +
        '<div id="wm-ai" class="notice" hidden></div>';

      $('#word-modal').hidden = false;
      // Kids tap a word mainly to hear it — don't make them find the button.
      if (isKids()) global.SpeechEngine.speak(w.gurmukhi, speakOpts());
    });
  }

  function speakOpts() {
    return { rate: state.settings.voiceRate, voiceURI: state.settings.voiceURI };
  }

  function dialectLabel(id) {
    var found = (global.VOCAB_DIALECTS || []).filter(function (d) { return d.id === id; })[0];
    return found ? found.label : id;
  }

  function tierLabel(tier) {
    var found = (global.VOCAB_TIERS || []).filter(function (t) { return t.id === tier; })[0];
    return found ? found.label : 'level ' + tier;
  }

  /* ══════════════════════════════════════════════════
     PRACTICE
     ══════════════════════════════════════════════════ */

  function renderPracticeSetup() {
    $('#practice-setup').hidden = false;
    $('#practice-run').hidden = true;
    $('#practice-done').hidden = true;

    global.Practice.summary().then(function (s) {
      $('#practice-due').textContent = s.due > 0
        ? s.due + ' word' + (s.due === 1 ? '' : 's') + ' due for review'
        : s.unseen + ' new word' + (s.unseen === 1 ? '' : 's') + ' waiting';
    });
  }

  function startPractice() {
    global.Practice.buildSession({
      mode: state.settings.mode,
      category: $('#practice-category').value,
      tier: isKids() ? 'all' : $('#practice-tier').value,
      size: Number($('#practice-size').value)
    }).then(function (session) {
      if (session.stats.tooFew || !session.questions.length) {
        toast('Not enough verified words there yet — try another category.', 'warn');
        return;
      }
      state.session = {
        questions: session.questions,
        index: 0,
        correct: 0,
        answers: []
      };
      $('#practice-setup').hidden = true;
      $('#practice-done').hidden = true;
      $('#practice-run').hidden = false;
      renderQuestion();
    });
  }

  function renderQuestion() {
    var s = state.session;
    var q = s.questions[s.index];

    $('#session-counter').textContent = (s.index + 1) + ' / ' + s.questions.length;
    $('#practice-progress').style.width = (s.index / s.questions.length * 100) + '%';
    $('#q-feedback').hidden = true;
    $('#btn-next').hidden = true;

    var card = $('#q-card');

    if (q.choices) {
      card.innerHTML = renderPrompt(q) +
        '<div class="choice-grid' + (q.choices[0].emoji ? ' choice-emoji' : '') + '">' +
        q.choices.map(function (c, i) {
          var inner = c.emoji
            ? '<span class="ch-emoji" aria-hidden="true">' + esc(c.emoji) + '</span><span class="ch-label">' + esc(c.label) + '</span>'
            : c.gurmukhi
              ? '<span class="ch-gurmukhi" lang="pa">' + esc(c.gurmukhi) + '</span>' +
                (state.settings.showLatin ? '<span class="ch-latin">' + esc(c.latin) + '</span>' : '')
              : '<span class="ch-label">' + esc(c.label) + '</span>';
          return '<button class="choice" type="button" data-choice="' + i + '">' + inner + '</button>';
        }).join('') +
        '</div>';
    } else if (q.type === 'say-it') {
      card.innerHTML = renderPrompt(q) +
        '<div class="say-wrap">' +
          '<button class="btn btn-primary btn-block" type="button" id="btn-listen">🎤 Say it</button>' +
          '<button class="btn btn-ghost btn-block btn-sm" type="button" data-skip>Skip this one</button>' +
        '</div>';
    } else {
      card.innerHTML = renderPrompt(q) +
        '<form class="answer-form" id="answer-form">' +
          '<input type="text" id="answer-input" lang="pa" class="gurmukhi-input" ' +
            'placeholder="Type in Gurmukhi or roman letters" autocomplete="off" autocapitalize="off" spellcheck="false" />' +
          '<button class="btn btn-primary" type="submit">Check</button>' +
        '</form>';
      var input = $('#answer-input');
      if (input) input.focus();
    }

    // Audio prompts play themselves — that's the whole question.
    if (q.prompt.kind === 'audio') {
      global.SpeechEngine.speak(q.prompt.text, speakOpts());
    }
  }

  function renderPrompt(q) {
    var p = q.prompt;
    switch (p.kind) {
      case 'audio':
        return '<div class="q-prompt q-audio">' +
          '<button class="big-speaker" type="button" data-speak="' + esc(p.text) + '" aria-label="Play the word again">🔊</button>' +
          '<p class="q-hint">Listen, then tap what it means</p></div>';
      case 'gurmukhi':
        return '<div class="q-prompt">' +
          '<p class="q-gurmukhi" lang="pa">' + esc(p.text) + '</p>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-speak="' + esc(p.text) + '">🔊</button>' +
          '<p class="q-hint">What does this mean?</p></div>';
      case 'blank':
        return '<div class="q-prompt">' +
          '<p class="q-gurmukhi q-sentence" lang="pa">' + esc(p.text) + '</p>' +
          '<p class="q-hint">Fill the blank — the word means “' + esc(p.meaning) + '”</p></div>';
      case 'say':
        return '<div class="q-prompt">' +
          '<p class="q-gurmukhi" lang="pa">' + esc(p.text) + '</p>' +
          (state.settings.showLatin ? '<p class="q-latin">' + esc(p.latin) + '</p>' : '') +
          '<button class="btn btn-ghost btn-sm" type="button" data-speak="' + esc(p.text) + '">🔊 Hear it first</button>' +
          '<p class="q-hint">Now say it out loud</p></div>';
      default:
        return '<div class="q-prompt">' +
          '<p class="q-meaning">' + esc(p.text) + '</p>' +
          '<p class="q-hint">Which word is this?</p></div>';
    }
  }

  function answerQuestion(correct, detail) {
    var s = state.session;
    var q = s.questions[s.index];

    if (correct) s.correct++;
    s.answers.push({ word: q.word, correct: correct });

    global.Practice.record(q.wordId, correct);

    var fb = $('#q-feedback');
    fb.className = 'q-feedback ' + (correct ? 'good' : 'bad');
    fb.innerHTML =
      '<p class="fb-verdict">' + (correct ? (isKids() ? 'ਸ਼ਾਬਾਸ਼! 🌟' : 'Correct') : (isKids() ? 'ਕੋਈ ਗੱਲ ਨਹੀਂ 💛' : 'Not quite')) + '</p>' +
      '<p class="fb-word" lang="pa">' + esc(q.word.gurmukhi) + '</p>' +
      (state.settings.showLatin ? '<p class="fb-latin">' + esc(q.word.latin) + '</p>' : '') +
      '<p class="fb-meaning">' + esc(q.word.meaning) + '</p>' +
      (detail ? '<p class="fb-detail">' + esc(detail) + '</p>' : '') +
      (q.word.example && q.word.example.gurmukhi
        ? '<p class="fb-example" lang="pa">' + esc(q.word.example.gurmukhi) + '</p>' : '');
    fb.hidden = false;

    // Lock the choices so a tap after answering can't double-score.
    $$('#q-card .choice').forEach(function (btn, i) {
      btn.disabled = true;
      if (q.choices && q.choices[i].correct) btn.classList.add('is-correct');
    });
    var form = $('#answer-form');
    if (form) $$('input, button', form).forEach(function (el) { el.disabled = true; });
    var listen = $('#btn-listen');
    if (listen) listen.disabled = true;

    if (!correct || isKids()) global.SpeechEngine.speak(q.word.gurmukhi, speakOpts());

    $('#btn-next').hidden = false;
    $('#btn-next').textContent = (s.index + 1 >= s.questions.length) ? 'See results' : 'Next';
    $('#btn-next').focus();
  }

  function nextQuestion() {
    var s = state.session;
    s.index++;
    if (s.index >= s.questions.length) finishSession();
    else renderQuestion();
  }

  function finishSession() {
    var s = state.session;
    var pct = Math.round(s.correct / s.questions.length * 100);

    $('#practice-run').hidden = true;
    $('#practice-done').hidden = false;
    $('#practice-progress').style.width = '100%';

    $('#summary-emoji').textContent = pct >= 80 ? '🌟' : pct >= 50 ? '👏' : '💪';
    $('#summary-title').textContent = pct >= 80 ? 'ਬਹੁਤ ਵਧੀਆ!' : pct >= 50 ? 'Good going' : 'Keep at it';
    $('#summary-score').textContent = s.correct + ' of ' + s.questions.length + ' correct';

    $('#summary-list').innerHTML = s.answers.map(function (a) {
      return '<div class="summary-row ' + (a.correct ? 'good' : 'bad') + '">' +
        '<span aria-hidden="true">' + (a.correct ? '✓' : '✗') + '</span>' +
        '<span lang="pa" class="sr-gurmukhi">' + esc(a.word.gurmukhi) + '</span>' +
        '<span class="sr-meaning">' + esc(a.word.meaning) + '</span>' +
        '</div>';
    }).join('');

    state.session = null;
  }

  /* ══════════════════════════════════════════════════
     CONTRIBUTE
     ══════════════════════════════════════════════════ */

  function renderContribute() {
    var canRecord = global.SpeechEngine.canRecord;
    $('#record-row').hidden = !canRecord;
    $('#record-hint').hidden = !canRecord;
    renderMySubmissions();
  }

  function renderMySubmissions() {
    global.Verify.myPending().then(function (rows) {
      if (!rows.length) {
        $('#my-submissions').innerHTML =
          '<p class="empty-note">You haven\'t added any words yet. The first one is the hardest.</p>';
        return;
      }
      $('#my-submissions').innerHTML = rows.map(function (r) {
        var w = r.word, t = r.tally;
        var statusNote = w.status === 'verified'
          ? 'Verified by the community — it\'s in the dictionary now.'
          : w.status === 'disputed'
            ? 'Reviewers raised doubts. Check their notes and fix it.'
            : t.needed + ' more confirmation' + (t.needed === 1 ? '' : 's') + ' needed.';

        var notes = (r.votes || []).filter(function (v) { return v.note; });

        return '<div class="sub-card status-' + esc(w.status) + '">' +
          '<div class="sub-head">' +
            '<span lang="pa" class="sub-gurmukhi">' + esc(w.gurmukhi) + '</span>' +
            '<span class="status-badge">' + esc(w.status) + '</span>' +
          '</div>' +
          '<p class="sub-meaning">' + esc(w.meaning) + '</p>' +
          '<p class="sub-note">' + esc(statusNote) + '</p>' +
          (notes.length
            ? '<div class="sub-notes">' + notes.map(function (v) {
                return '<p><b>' + esc(v.value) + ':</b> ' + esc(v.note) + '</p>';
              }).join('') + '</div>'
            : '') +
          '</div>';
      }).join('');
    });
  }

  function checkDuplicates() {
    var value = $('#c-gurmukhi').value.trim();
    var box = $('#dupe-warning');
    if (!value) { box.hidden = true; return; }

    global.Contribute.findDuplicates(value).then(function (hits) {
      if (!hits.length) { box.hidden = true; return; }
      var top = hits[0];
      box.innerHTML =
        '<b>' + (top.kind === 'exact' ? 'This word is already here.' : 'Something very similar is already here.') + '</b> ' +
        '<span lang="pa">' + esc(top.word.gurmukhi) + '</span> — ' + esc(top.word.meaning) + '. ' +
        'If yours is a different word or a dialect variant, carry on and say so in the notes.';
      box.hidden = false;
    });
  }

  function submitContribution(e) {
    e.preventDefault();

    var draft = {
      gurmukhi: $('#c-gurmukhi').value,
      latin: $('#c-latin').value,
      pos: $('#c-pos').value,
      meaning: $('#c-meaning').value,
      category: $('#c-category').value,
      tier: Number($('#c-tier').value),
      dialect: $('#c-dialect').value,
      emoji: $('#c-emoji').value,
      example: { gurmukhi: $('#c-example').value, latin: '' },
      notes: $('#c-notes').value
    };

    ['gurmukhi', 'meaning', 'example'].forEach(function (f) {
      $('#err-' + f).hidden = true;
    });

    global.Contribute.submit(draft, state.recording).then(function (result) {
      if (!result.ok) {
        Object.keys(result.errors).forEach(function (field) {
          var el = $('#err-' + field);
          if (el) { el.textContent = result.errors[field]; el.hidden = false; }
        });
        toast('Please fix the highlighted fields.', 'warn');
        return;
      }

      var box = $('#contribute-result');
      box.innerHTML = '<b>ਸ਼ੁਕਰੀਆ!</b> “' + esc(result.word.gurmukhi) + '” is now in the review queue. ' +
        'Once other speakers confirm it, it joins the dictionary for everyone.';
      box.hidden = false;

      $('#contribute-form').reset();
      $('#dupe-warning').hidden = true;
      $('#ai-draft-check').hidden = true;
      clearRecording();
      renderMySubmissions();
      refreshBadges();
      $('#c-gurmukhi').focus();
      setTimeout(function () { box.hidden = true; }, 8000);
    }).catch(function (err) {
      toast(err.message || 'Could not save that word.', 'bad');
    });
  }

  /* ── recording ──────────────────────────────────── */

  function toggleRecording() {
    var btn = $('#btn-record');
    var label = $('#record-label');

    if (global.SpeechEngine.isRecording) {
      global.SpeechEngine.stopRecording().then(function (blob) {
        btn.classList.remove('recording');
        label.textContent = blob ? 'Re-record' : 'Record how it sounds';
        state.recording = blob;
        $('#btn-play-recording').hidden = !blob;
        $('#btn-clear-recording').hidden = !blob;
      });
      return;
    }

    global.SpeechEngine.record().then(function () {
      btn.classList.add('recording');
      label.textContent = 'Stop recording';
    }).catch(function (err) {
      toast(err.message || 'Could not start recording.', 'bad');
    });
  }

  function clearRecording() {
    state.recording = null;
    $('#btn-play-recording').hidden = true;
    $('#btn-clear-recording').hidden = true;
    $('#record-label').textContent = 'Record how it sounds';
    $('#btn-record').classList.remove('recording');
  }

  /* ══════════════════════════════════════════════════
     REVIEW
     ══════════════════════════════════════════════════ */

  function renderReview() {
    $('#my-weight').textContent = global.Verify.voteWeight(state.profile.reputation);

    global.Verify.queue().then(function (queue) {
      $('#review-empty').hidden = queue.length > 0;
      $('#review-queue').innerHTML = queue.map(function (item) {
        var w = item.word;
        return '<div class="review-card" data-review="' + esc(w.id) + '">' +
          '<div class="rv-head">' +
            '<span class="rv-emoji" aria-hidden="true">' + esc(w.emoji) + '</span>' +
            '<div>' +
              '<p class="rv-gurmukhi" lang="pa">' + esc(w.gurmukhi) + '</p>' +
              '<p class="rv-latin">' + esc(w.latin) + '</p>' +
            '</div>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-speak="' + esc(w.gurmukhi) + '">🔊</button>' +
          '</div>' +
          '<p class="rv-meaning">' + esc(w.meaning) + '</p>' +
          '<p class="rv-meta">' + esc(w.pos) + ' · ' + esc(w.category) + ' · ' +
            esc(dialectLabel(w.dialect)) + ' · by ' + esc(w.contributorName || 'Anonymous') + '</p>' +
          (w.example && w.example.gurmukhi
            ? '<p class="rv-example" lang="pa">' + esc(w.example.gurmukhi) + '</p>' : '') +
          (w.notes ? '<p class="rv-notes">“' + esc(w.notes) + '”</p>' : '') +
          (w.hasAudio
            ? '<button class="btn btn-ghost btn-sm" type="button" data-play-clip="' + esc(w.id) + '">🎙 Hear the contributor</button>' : '') +
          '<p class="rv-tally">' + item.tally.confirms + ' confirm · ' + item.tally.doubts + ' doubt · ' +
            item.tally.needed + ' more needed</p>' +
          '<textarea class="rv-note" rows="1" placeholder="Note (optional) — a correction, or why you doubt it"></textarea>' +
          '<div class="rv-actions">' +
            '<button class="btn btn-good" type="button" data-vote="confirm">✓ Looks right</button>' +
            '<button class="btn btn-warn" type="button" data-vote="doubt">✗ Not right</button>' +
          '</div>' +
        '</div>';
      }).join('');
    });

    global.Verify.disputed().then(function (rows) {
      $('#disputed-head').hidden = rows.length === 0;
      $('#disputed-list').innerHTML = rows.map(function (r) {
        var notes = (r.votes || []).filter(function (v) { return v.note; });
        return '<div class="sub-card status-disputed">' +
          '<div class="sub-head">' +
            '<span lang="pa" class="sub-gurmukhi">' + esc(r.word.gurmukhi) + '</span>' +
            '<span class="status-badge">disputed</span>' +
          '</div>' +
          '<p class="sub-meaning">' + esc(r.word.meaning) + '</p>' +
          (notes.length
            ? '<div class="sub-notes">' + notes.map(function (v) {
                return '<p>' + esc(v.note) + '</p>';
              }).join('') + '</div>'
            : '<p class="sub-note">No reason given.</p>') +
        '</div>';
      }).join('');
    });
  }

  function castVote(cardEl, value) {
    var wordId = cardEl.dataset.review;
    var note = ($('.rv-note', cardEl) || {}).value || '';

    $$('button', cardEl).forEach(function (b) { b.disabled = true; });

    global.Verify.vote(wordId, value, { note: note }).then(function (result) {
      if (!result.ok) {
        toast(voteError(result.reason), 'warn');
        renderReview();
        return;
      }

      if (result.settled) {
        toast(result.status === 'verified'
          ? 'Confirmed — that word is now in the dictionary. 🌟'
          : 'Marked as disputed. It goes back for a fix.', result.status === 'verified' ? 'good' : 'warn');
      } else {
        toast('Vote recorded. ' + result.tally.needed + ' more needed.', 'good');
      }

      return global.Store.getProfile().then(function (p) {
        state.profile = p;
        refreshBadges();
        renderReview();
      });
    }).catch(function (err) {
      toast(err.message || 'Could not record that vote.', 'bad');
      renderReview();
    });
  }

  function voteError(reason) {
    return {
      'self-vote': 'You cannot vote on your own word.',
      'duplicate-vote': 'You already voted on that one.',
      'already-resolved': 'That word was decided while you were looking at it.',
      'not-found': 'That word no longer exists.'
    }[reason] || 'Vote could not be recorded.';
  }

  /* ══════════════════════════════════════════════════
     TUTOR
     ══════════════════════════════════════════════════ */

  function renderTutor() {
    global.AiTutor.isConfigured().then(function (ok) {
      $('#tutor-setup').hidden = ok;
    });

    $('#chat-suggestions').innerHTML = global.AiTutor.suggestions(state.settings.mode)
      .map(function (s) { return '<button class="chip" data-suggest="' + esc(s) + '">' + esc(s) + '</button>'; })
      .join('');

    if (!state.chat.length) {
      $('#chat-log').innerHTML =
        '<div class="chat-empty">' +
          '<p class="chat-empty-emoji" aria-hidden="true">💬</p>' +
          '<p>' + (isKids()
            ? 'Ask me anything about Punjabi words!'
            : 'Ask about a word, a dialect, or check a sentence you wrote.') + '</p>' +
        '</div>';
    }
  }

  function sendChat(text) {
    text = String(text || '').trim();
    if (!text || state.streaming) return;

    state.chat.push({ role: 'user', content: text });
    $('#chat-text').value = '';
    renderChatLog();

    var bubble = document.createElement('div');
    bubble.className = 'bubble assistant streaming';
    bubble.textContent = '';
    $('#chat-log').appendChild(bubble);
    scrollChat();

    state.streaming = true;
    $('#chat-send').disabled = true;

    var reply = '';
    global.AiTutor.chat(state.chat, {
      mode: state.settings.mode,
      onToken: function (token) {
        reply += token;
        bubble.textContent = reply;
        scrollChat();
      }
    }).then(function (full) {
      state.chat.push({ role: 'assistant', content: full || reply });
      renderChatLog();
    }).catch(function (err) {
      bubble.remove();
      if (err.code === 'no-key') {
        $('#tutor-setup').hidden = false;
        toast('Add your API key in Settings to use the tutor.', 'warn');
      } else {
        toast(err.message || 'The tutor could not reply.', 'bad');
      }
      // Drop the unanswered turn so the next message isn't sent twice.
      state.chat.pop();
      renderChatLog();
    }).then(function () {
      state.streaming = false;
      $('#chat-send').disabled = false;
    });
  }

  function renderChatLog() {
    if (!state.chat.length) { renderTutor(); return; }
    $('#chat-log').innerHTML = state.chat.map(function (m) {
      return '<div class="bubble ' + (m.role === 'user' ? 'user' : 'assistant') + '">' +
        esc(m.content) + '</div>';
    }).join('');
    scrollChat();
  }

  function scrollChat() {
    var log = $('#chat-log');
    log.scrollTop = log.scrollHeight;
  }

  /* ══════════════════════════════════════════════════
     PROGRESS
     ══════════════════════════════════════════════════ */

  function renderProgress() {
    global.Practice.summary().then(function (s) {
      $('#stat-grid').innerHTML = [
        stat('📚', s.total, 'words available'),
        stat('👀', s.seen, 'started learning'),
        stat('🌟', s.learned, 'well known'),
        stat('⏰', s.due, 'due for review')
      ].join('');
    });

    global.Verify.stats().then(function (v) {
      state.profile = v.profile;
      $('#rep-value').textContent = v.profile.reputation || 0;

      $('#contrib-grid').innerHTML = [
        stat('⭐', v.profile.reputation || 0, 'reputation'),
        stat('➕', v.profile.submitted || 0, 'words added'),
        stat('✅', v.profile.verifiedCount || 0, 'of yours verified'),
        stat('🔍', v.myVotes, 'reviews cast'),
        stat('⚖️', v.myWeight + '×', 'your vote weight'),
        stat('🌱', v.counts.community, 'community words')
      ].join('');
    });

    global.Store.getWords({ status: 'verified' }).then(function (words) {
      return global.Store.getProgress().then(function (progress) {
        var byCat = {};
        words.forEach(function (w) {
          if (!byCat[w.category]) byCat[w.category] = { total: 0, seen: 0 };
          byCat[w.category].total++;
          if (progress[w.id]) byCat[w.category].seen++;
        });

        $('#category-progress').innerHTML = global.VOCAB_CATEGORIES.map(function (c) {
          var d = byCat[c.id] || { total: 0, seen: 0 };
          var pct = d.total ? Math.round(d.seen / d.total * 100) : 0;
          return '<div class="cat-row">' +
            '<span class="cat-name">' + c.emoji + ' ' + esc(c.label) + '</span>' +
            '<span class="cat-bar"><span class="cat-fill" style="width:' + pct + '%"></span></span>' +
            '<span class="cat-num">' + d.seen + '/' + d.total + '</span>' +
          '</div>';
        }).join('');
      });
    });
  }

  function stat(emoji, value, label) {
    return '<div class="stat"><span class="stat-emoji" aria-hidden="true">' + emoji + '</span>' +
      '<span class="stat-value">' + esc(value) + '</span>' +
      '<span class="stat-label">' + esc(label) + '</span></div>';
  }

  /* ══════════════════════════════════════════════════
     SETTINGS
     ══════════════════════════════════════════════════ */

  function openSettings() {
    var s = state.settings;
    $('#s-name').value = state.profile.name || '';
    $('#s-mode').value = s.mode;
    $('#s-theme').value = s.theme;
    $('#s-dialect').value = state.profile.dialect || 'common';
    $('#s-rate').value = s.voiceRate;
    $('#rate-value').textContent = s.voiceRate;
    $('#s-showlatin').checked = !!s.showLatin;
    $('#s-apikey').value = s.apiKey || '';
    $('#s-model').value = s.model || global.AiTutor.DEFAULT_MODEL;
    populateVoices();
    $('#settings-result').hidden = true;
    $('#settings-modal').hidden = false;
  }

  function populateVoices() {
    var voices = global.SpeechEngine.getVoices();
    var sel = $('#s-voice');
    if (!sel) return;

    if (!global.SpeechEngine.canSpeak) {
      sel.innerHTML = '<option>Not supported in this browser</option>';
      sel.disabled = true;
      $('#voice-hint').textContent = '';
      return;
    }

    var preferred = global.SpeechEngine.getPreferredVoice(state.settings.voiceURI);
    sel.innerHTML = '<option value="">Best available (' +
      (preferred ? esc(preferred.name) : 'default') + ')</option>' +
      voices.map(function (v) {
        return '<option value="' + esc(v.voiceURI) + '">' + esc(v.name) + ' — ' + esc(v.lang) + '</option>';
      }).join('');
    sel.value = state.settings.voiceURI || '';

    $('#voice-hint').textContent = global.SpeechEngine.hasPunjabiVoice()
      ? 'A Punjabi voice is installed on this device.'
      : 'No Punjabi voice found — falling back to Hindi, which is close but not exact.';
  }

  function saveSettingsFromForm() {
    var patch = {
      mode: $('#s-mode').value,
      theme: $('#s-theme').value,
      voiceRate: Number($('#s-rate').value),
      voiceURI: $('#s-voice').value,
      showLatin: $('#s-showlatin').checked,
      apiKey: $('#s-apikey').value.trim(),
      model: $('#s-model').value
    };

    return Promise.all([
      global.Store.setSettings(patch),
      global.Store.updateProfile({
        name: $('#s-name').value.trim(),
        dialect: $('#s-dialect').value
      })
    ]).then(function (parts) {
      state.settings = parts[0];
      state.profile = parts[1];
      applyMode();
      applyTheme();
      refreshBadges();
      route();
    });
  }

  function exportData() {
    global.Store.exportJSON().then(function (json) {
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'bolee-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      settingsResult('Exported. Recordings stay on this device — the file lists which words have them.', 'good');
    });
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      global.Store.importJSON(reader.result, { merge: true })
        .then(function (summary) {
          settingsResult('Merged ' + summary.words + ' words, ' + summary.votes +
            ' votes and ' + summary.progress + ' progress records.', 'good');
          return Promise.all([global.Store.getSettings(), global.Store.getProfile()]);
        })
        .then(function (parts) {
          state.settings = parts[0];
          state.profile = parts[1];
          applyMode();
          applyTheme();
          refreshBadges();
          route();
        })
        .catch(function (err) {
          settingsResult(err.message || 'That file could not be read.', 'bad');
        });
    };
    reader.readAsText(file);
  }

  function settingsResult(message, kind) {
    var box = $('#settings-result');
    box.className = 'notice notice-' + (kind === 'bad' ? 'warn' : 'good');
    box.textContent = message;
    box.hidden = false;
  }

  function resetEverything() {
    var ok = confirm(
      'This deletes every word you have added, all your votes, your progress and your recordings ' +
      'from this browser. It cannot be undone.\n\nExport first if you want to keep any of it.\n\nReset now?'
    );
    if (!ok) return;

    global.Store.reset().then(function () {
      return Promise.all([global.Store.getSettings(), global.Store.getProfile()]);
    }).then(function (parts) {
      state.settings = parts[0];
      state.profile = parts[1];
      state.chat = [];
      applyMode();
      applyTheme();
      refreshBadges();
      settingsResult('Everything has been reset.', 'good');
      route();
    });
  }

  /* ══════════════════════════════════════════════════
     Event wiring — delegated where the DOM is rebuilt
     ══════════════════════════════════════════════════ */

  function wireEvents() {

    /* ── header ── */
    $('#btn-settings').addEventListener('click', openSettings);
    $('#btn-mode').addEventListener('click', function () {
      var next = isKids() ? 'adult' : 'kids';
      global.Store.setSettings({ mode: next }).then(function (s) {
        state.settings = s;
        applyMode();
        refreshBadges();
        // Kids mode has no contribute/review view to return to.
        if (isKids() && KIDS_BLOCKED.indexOf(currentRoute()) !== -1) location.hash = '#/learn';
        else route();
        toast(next === 'kids' ? 'Kids mode on 🧒' : 'Adult mode on 🧑');
      });
    });

    /* ── learn filters ── */
    $('#category-chips').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-cat]');
      if (!chip) return;
      state.filter.category = chip.dataset.cat;
      $$('#category-chips .chip').forEach(function (c) { c.classList.toggle('active', c === chip); });
      renderLearn();
    });

    $('#tier-filter').addEventListener('click', function (e) {
      var pill = e.target.closest('[data-tier]');
      if (!pill) return;
      state.filter.tier = pill.dataset.tier;
      $$('#tier-filter .pill').forEach(function (p) { p.classList.toggle('active', p === pill); });
      renderLearn();
    });

    var searchTimer;
    $('#search').addEventListener('input', function (e) {
      clearTimeout(searchTimer);
      var value = e.target.value;
      searchTimer = setTimeout(function () {
        state.filter.search = value;
        renderLearn();
      }, 180);
    });

    $('#word-grid').addEventListener('click', function (e) {
      var card = e.target.closest('[data-word]');
      if (card) openWord(card.dataset.word);
    });

    /* ── practice ── */
    $('#btn-start-practice').addEventListener('click', startPractice);
    $('#btn-next').addEventListener('click', nextQuestion);
    $('#btn-again').addEventListener('click', renderPracticeSetup);
    $('#btn-back-learn').addEventListener('click', function () { location.hash = '#/learn'; });
    $('#btn-quit').addEventListener('click', function () {
      state.session = null;
      renderPracticeSetup();
    });

    $('#q-card').addEventListener('click', function (e) {
      var choice = e.target.closest('[data-choice]');
      if (choice && state.session) {
        var q = state.session.questions[state.session.index];
        answerQuestion(!!q.choices[Number(choice.dataset.choice)].correct);
        return;
      }
      if (e.target.closest('[data-skip]')) {
        answerQuestion(false, 'Skipped');
        return;
      }
      if (e.target.closest('#btn-listen')) {
        doListen();
      }
    });

    $('#q-card').addEventListener('submit', function (e) {
      if (e.target.id !== 'answer-form') return;
      e.preventDefault();
      var q = state.session.questions[state.session.index];
      var given = $('#answer-input').value;
      var result = global.Practice.checkAnswer(q, given);
      answerQuestion(result.correct,
        result.correct
          ? (result.matched === 'latin' || result.matched === 'latin-close'
              ? 'Accepted your roman spelling — in Gurmukhi it is ' + q.answer : '')
          : 'You wrote: ' + given);
    });

    // Enter advances between questions in adult mode — practice should flow.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if ($('#view-practice').hidden) return;
      var next = $('#btn-next');
      if (!next.hidden && document.activeElement !== $('#answer-input')) {
        e.preventDefault();
        nextQuestion();
      }
    });

    /* ── contribute ── */
    var dupeTimer;
    $('#c-gurmukhi').addEventListener('input', function (e) {
      var value = e.target.value;
      // Fill the romanisation as they type, but never overwrite a manual edit.
      var latin = $('#c-latin');
      if (!latin.dataset.touched) latin.value = global.Contribute.transliterate(value);
      clearTimeout(dupeTimer);
      dupeTimer = setTimeout(checkDuplicates, 400);
    });
    $('#c-latin').addEventListener('input', function (e) { e.target.dataset.touched = '1'; });
    $('#contribute-form').addEventListener('submit', submitContribution);
    $('#btn-record').addEventListener('click', toggleRecording);
    $('#btn-play-recording').addEventListener('click', function () {
      global.SpeechEngine.playBlob(state.recording);
    });
    $('#btn-clear-recording').addEventListener('click', clearRecording);

    $('#btn-ask-ai').addEventListener('click', function () {
      var draft = { gurmukhi: $('#c-gurmukhi').value.trim(), meaning: $('#c-meaning').value.trim() };
      if (!draft.gurmukhi) { toast('Write the word first.', 'warn'); return; }

      var box = $('#ai-draft-check');
      box.className = 'notice';
      box.textContent = 'Asking the tutor…';
      box.hidden = false;

      var reply = '';
      global.AiTutor.askAboutDraft(draft, {
        onToken: function (t) { reply += t; box.textContent = reply; }
      }).catch(function (err) {
        box.className = 'notice notice-warn';
        box.textContent = err.message || 'Could not reach the tutor.';
      });
    });

    /* ── review (delegated: cards are re-rendered constantly) ── */
    $('#review-queue').addEventListener('click', function (e) {
      var voteBtn = e.target.closest('[data-vote]');
      if (!voteBtn) return;
      var card = voteBtn.closest('[data-review]');
      if (card) castVote(card, voteBtn.dataset.vote);
    });

    /* ── tutor ── */
    $('#chat-form').addEventListener('submit', function (e) {
      e.preventDefault();
      sendChat($('#chat-text').value);
    });
    $('#chat-suggestions').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-suggest]');
      if (chip) sendChat(chip.dataset.suggest);
    });
    $('#btn-tutor-settings').addEventListener('click', openSettings);

    /* ── settings ── */
    ['#s-mode', '#s-theme', '#s-voice', '#s-showlatin', '#s-model', '#s-dialect'].forEach(function (sel) {
      $(sel).addEventListener('change', saveSettingsFromForm);
    });
    $('#s-rate').addEventListener('input', function (e) {
      $('#rate-value').textContent = e.target.value;
    });
    $('#s-rate').addEventListener('change', saveSettingsFromForm);
    $('#s-name').addEventListener('change', saveSettingsFromForm);
    $('#s-apikey').addEventListener('change', saveSettingsFromForm);

    $('#btn-export').addEventListener('click', exportData);
    $('#btn-import').addEventListener('click', function () { $('#import-file').click(); });
    $('#import-file').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
      e.target.value = '';
    });
    $('#btn-reset').addEventListener('click', resetEverything);

    /* ── modals ── */
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-close-modal]')) {
        $('#word-modal').hidden = true;
        $('#settings-modal').hidden = true;
        global.SpeechEngine.stopSpeaking();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        $('#word-modal').hidden = true;
        $('#settings-modal').hidden = true;
      }
    });

    /* ── global: anything with data-speak or data-play-clip ── */
    document.addEventListener('click', function (e) {
      var speaker = e.target.closest('[data-speak]');
      if (speaker) {
        global.SpeechEngine.speak(speaker.dataset.speak, speakOpts());
        return;
      }
      var clip = e.target.closest('[data-play-clip]');
      if (clip) {
        global.Store.audio.get(clip.dataset.playClip).then(function (blob) {
          if (blob) global.SpeechEngine.playBlob(blob);
          else toast('That recording is not on this device.', 'warn');
        });
        return;
      }
      var explain = e.target.closest('[data-explain]');
      if (explain) explainInModal(explain.dataset.explain);
    });
  }

  function explainInModal(wordId) {
    var box = $('#wm-ai');
    box.className = 'notice';
    box.textContent = 'Asking the tutor…';
    box.hidden = false;

    global.Store.getWord(wordId).then(function (word) {
      var reply = '';
      return global.AiTutor.explainWord(word, {
        mode: state.settings.mode,
        onToken: function (t) { reply += t; box.textContent = reply; }
      });
    }).catch(function (err) {
      box.className = 'notice notice-warn';
      box.textContent = err.code === 'no-key'
        ? 'Add your Anthropic API key in Settings to use the tutor.'
        : (err.message || 'Could not reach the tutor.');
    });
  }

  function doListen() {
    var q = state.session.questions[state.session.index];
    var btn = $('#btn-listen');
    btn.textContent = '🎙 Listening…';
    btn.disabled = true;

    global.SpeechEngine.listen({ lang: 'pa-IN' }).then(function (result) {
      var check = global.Practice.checkAnswer(q, result.transcript);
      // Recognition often returns Devanagari or an approximation — accept a
      // close romanised match rather than failing a correct pronunciation.
      answerQuestion(check.correct, 'Heard: “' + result.transcript + '”');
    }).catch(function (err) {
      btn.textContent = '🎤 Say it';
      btn.disabled = false;
      toast(err.message || 'Did not catch that.', 'warn');
    });
  }

  /* ══════════════════════════════════════════════════ */

  var App = {
    boot: boot,
    route: route,
    state: state,
    toast: toast
  };

  global.App = App;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window);
