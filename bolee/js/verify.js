/* ══════════════════════════════════════════════════
   Bolee — Verification  →  window.Verify
   ──────────────────────────────────────────────────
   Community review of contributed words.

   Reputation-weighted voting is what lets this scale
   without an admin in the loop: proven contributors
   carry more weight than a drive-by vote, but the cap
   stops any one account from unilaterally deciding.
   ══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* Every threshold in one place — tuning is a one-line change. */
  var CONFIG = {
    CONFIRM_THRESHOLD: 3,   // net weighted confirms to reach `verified`
    DISPUTE_THRESHOLD: 3,   // weighted doubts to reach `disputed`
    WEIGHT_PER_REP: 10,     // +1 vote weight per this much reputation
    MAX_WEIGHT: 3,

    REP_WORD_VERIFIED: 2,   // your submission cleared review
    REP_WORD_DISPUTED: -1,  // your submission was rejected
    REP_VOTE_CAST: 1,       // you voted and the crowd agreed with you
    REP_VOTE_WRONG: 0       // voting against the outcome isn't punished —
                            // punishing dissent would suppress real corrections
  };

  /** Vote weight from a contributor's reputation. Pure — tested directly. */
  function voteWeight(reputation) {
    var rep = Number(reputation) || 0;
    if (rep < 0) rep = 0;
    return Math.min(CONFIG.MAX_WEIGHT, 1 + Math.floor(rep / CONFIG.WEIGHT_PER_REP));
  }

  /**
   * Decide a word's status from its votes. Pure — no storage, no DOM.
   * @param {Array} votes  [{ voterId, value:'confirm'|'doubt', weight }]
   * @returns {{status, confirms, doubts, net, needed}}
   */
  function tally(votes) {
    var confirms = 0, doubts = 0;
    (votes || []).forEach(function (v) {
      var w = Number(v.weight) || 1;
      if (v.value === 'confirm') confirms += w;
      else if (v.value === 'doubt') doubts += w;
    });

    var net = confirms - doubts;
    var status = 'pending';
    if (doubts >= CONFIG.DISPUTE_THRESHOLD) status = 'disputed';
    else if (net >= CONFIG.CONFIRM_THRESHOLD) status = 'verified';

    return {
      status: status,
      confirms: confirms,
      doubts: doubts,
      net: net,
      needed: Math.max(0, CONFIG.CONFIRM_THRESHOLD - net)
    };
  }

  var Verify = {

    CONFIG: CONFIG,
    voteWeight: voteWeight,
    tally: tally,

    /**
     * Words awaiting review, excluding ones you wrote or already voted on.
     * Ordered oldest-first so nothing starves at the bottom of the queue.
     */
    queue: function () {
      return Promise.all([
        global.Store.getWords({ status: 'pending' }),
        global.Store.getVotes(),
        global.Store.getProfile()
      ]).then(function (parts) {
        var pending = parts[0], allVotes = parts[1] || {}, profile = parts[2];

        return pending.filter(function (w) {
          if (w.contributorId === profile.id) return false;       // no self-review
          var votes = allVotes[w.id] || [];
          for (var i = 0; i < votes.length; i++) {
            if (votes[i].voterId === profile.id) return false;    // already voted
          }
          return true;
        }).map(function (w) {
          var t = tally(allVotes[w.id] || []);
          return {
            word: w,
            tally: t,
            voteCount: (allVotes[w.id] || []).length
          };
        }).sort(function (a, b) {
          return new Date(a.word.createdAt || 0) - new Date(b.word.createdAt || 0);
        });
      });
    },

    /** Your own pending words, with their current tally — the "waiting on the crowd" view. */
    myPending: function () {
      return Promise.all([
        global.Store.getProfile(),
        global.Store.getVotes()
      ]).then(function (parts) {
        var profile = parts[0], allVotes = parts[1] || {};
        return global.Store.getWords({ contributorId: profile.id }).then(function (mine) {
          return mine.map(function (w) {
            return { word: w, tally: tally(allVotes[w.id] || []), votes: allVotes[w.id] || [] };
          }).sort(function (a, b) {
            return new Date(b.word.createdAt || 0) - new Date(a.word.createdAt || 0);
          });
        });
      });
    },

    /** Words the crowd rejected — surfaced separately so they can be fixed, not lost. */
    disputed: function () {
      return Promise.all([
        global.Store.getWords({ status: 'disputed' }),
        global.Store.getVotes()
      ]).then(function (parts) {
        var words = parts[0], allVotes = parts[1] || {};
        return words.map(function (w) {
          return { word: w, tally: tally(allVotes[w.id] || []), votes: allVotes[w.id] || [] };
        });
      });
    },

    /**
     * Cast a vote on a pending word.
     * @param {string} wordId
     * @param {'confirm'|'doubt'} value
     * @param {object} [opts] { note, correction }
     * @returns {Promise<{ok, status, tally}|{ok:false, reason}>}
     */
    vote: function (wordId, value, opts) {
      opts = opts || {};
      if (value !== 'confirm' && value !== 'doubt') {
        return Promise.resolve({ ok: false, reason: 'bad-value' });
      }

      return Promise.all([
        global.Store.getWord(wordId),
        global.Store.getProfile(),
        global.Store.getVotes(wordId)
      ]).then(function (parts) {
        var word = parts[0], profile = parts[1], votes = parts[2] || [];

        if (!word) return { ok: false, reason: 'not-found' };
        if (word.status !== 'pending') return { ok: false, reason: 'already-resolved' };
        if (word.contributorId === profile.id) return { ok: false, reason: 'self-vote' };
        for (var i = 0; i < votes.length; i++) {
          if (votes[i].voterId === profile.id) return { ok: false, reason: 'duplicate-vote' };
        }

        var vote = {
          voterId: profile.id,
          voterName: profile.name || 'Anonymous',
          value: value,
          weight: voteWeight(profile.reputation),
          note: String(opts.note || '').trim(),
          correction: opts.correction || null
        };

        return global.Store.addVote(wordId, vote).then(function () {
          return global.Store.getVotes(wordId);
        }).then(function (allVotes) {
          var result = tally(allVotes);

          return global.Store.updateProfile({
            votesCast: (profile.votesCast || 0) + 1
          }).then(function () {
            if (result.status === 'pending') {
              return { ok: true, status: 'pending', tally: result };
            }
            // Threshold crossed — settle the word and pay out reputation.
            return settle(word, result, allVotes).then(function () {
              return { ok: true, status: result.status, tally: result, settled: true };
            });
          });
        });
      });
    },

    /**
     * Apply a correction from a doubt vote to a disputed word and send it
     * back for another round of review.
     */
    reviseAndResubmit: function (wordId, patch) {
      return global.Store.updateWord(wordId, Object.assign({}, patch, {
        status: 'pending',
        revisedAt: new Date().toISOString()
      }));
    },

    /** Numbers for the progress / community view. */
    stats: function () {
      return Promise.all([
        global.Store.getWords(),
        global.Store.getVotes(),
        global.Store.getProfile()
      ]).then(function (parts) {
        var words = parts[0], allVotes = parts[1] || {}, profile = parts[2];
        var counts = { verified: 0, pending: 0, disputed: 0, community: 0, seed: 0 };

        words.forEach(function (w) {
          if (counts[w.status] !== undefined) counts[w.status]++;
          if (w.source === 'seed') counts.seed++; else counts.community++;
        });

        var myVotes = 0;
        Object.keys(allVotes).forEach(function (id) {
          allVotes[id].forEach(function (v) { if (v.voterId === profile.id) myVotes++; });
        });

        return {
          counts: counts,
          profile: profile,
          myVotes: myVotes,
          myWeight: voteWeight(profile.reputation)
        };
      });
    }
  };

  /* ── settle: flip status, pay reputation ────────────
     Contributor is credited/debited for the outcome, and every voter who
     called it correctly gains a point. Voters on the losing side lose
     nothing — punishing dissent would suppress the corrections that make
     this dataset worth trusting.                                       */

  function settle(word, result, votes) {
    var winning = result.status === 'verified' ? 'confirm' : 'doubt';

    return global.Store.updateWord(word.id, {
      status: result.status,
      settledAt: new Date().toISOString()
    }).then(function () {
      return global.Store.getProfile();
    }).then(function (me) {
      var patch = {};

      // Reputation for the contributor — only reachable when the contributor
      // is this device's user, which is the local-first reality today. A shared
      // backend would apply this server-side to the word's actual author.
      if (word.contributorId === me.id) {
        var delta = result.status === 'verified'
          ? CONFIG.REP_WORD_VERIFIED
          : CONFIG.REP_WORD_DISPUTED;
        patch.reputation = (me.reputation || 0) + delta;
        if (result.status === 'verified') {
          patch.verifiedCount = (me.verifiedCount || 0) + 1;
        }
      }

      // Reputation for voters who matched the outcome.
      votes.forEach(function (v) {
        if (v.voterId !== me.id) return;
        if (v.value === winning) {
          patch.reputation = (patch.reputation !== undefined ? patch.reputation : (me.reputation || 0))
                             + CONFIG.REP_VOTE_CAST;
        }
      });

      if (Object.keys(patch).length === 0) return null;
      return global.Store.updateProfile(patch);
    });
  }

  global.Verify = Verify;

})(window);
