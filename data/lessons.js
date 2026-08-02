/* ══════════════════════════════════════════════════
   Bolee — Lessons  →  window.BOLEE_LESSONS
   ──────────────────────────────────────────────────
   Short readable lessons so the tutor view has real
   content with no key and no network. Each lesson is
   a list of blocks the renderer walks:

     {t:'p',    text}                 paragraph
     {t:'pair', gurmukhi, latin, english, note}
     {t:'h',    text}                 sub-heading
     {t:'tip',  text}                 highlighted note
   ══════════════════════════════════════════════════ */

(function (g) {
  'use strict';

  g.BOLEE_LESSONS = [

    {
      id: 'what-is-theth',
      title: 'What "theth" Punjabi means',
      emoji: '🌾',
      minutes: 3,
      summary: 'Why this app teaches ਚੁੱਲ੍ਹਾ before it teaches ਸਟੋਵ.',
      blocks: [
        { t: 'p', text: 'ਠੇਠ (theth) means pure, unmixed, native. Theth Punjabi is the register still spoken in villages — the one that has not been thinned out by Hindi, Urdu and English borrowings.' },
        { t: 'p', text: 'This matters because the borrowed words are the ones that survive. Every Punjabi in a city knows ਸਟੋਵ. Far fewer now know ਚੁੱਲ੍ਹਾ, and fewer still know ਖੁਰਲੀ or ਹੇਰਵਾ. When those go, the ideas behind them tend to go with them.' },
        { t: 'h', text: 'The same thing, two ways' },
        { t: 'pair', gurmukhi: 'ਬੂਹਾ', latin: 'booha', english: 'door — theth', note: 'against ਦਰਵਾਜ਼ਾ, a Persian borrowing' },
        { t: 'pair', gurmukhi: 'ਲੂਣ', latin: 'loon', english: 'salt — theth', note: 'against ਨਮਕ, from Hindi-Urdu' },
        { t: 'pair', gurmukhi: 'ਨਿਆਣਾ', latin: 'niaana', english: 'child — theth', note: 'against ਬੱਚਾ' },
        { t: 'pair', gurmukhi: 'ਹੁਨਾਲ਼', latin: 'hunaal', english: 'summer — theth', note: 'against ਗਰਮੀ' },
        { t: 'tip', text: 'Neither column is wrong. But if you only ever learn the right-hand one, you end up speaking Punjabi that sounds like translated Hindi.' }
      ]
    },

    {
      id: 'numbers',
      title: 'Counting in Punjabi',
      emoji: '🔢',
      minutes: 4,
      summary: 'One to twenty, then the tens — and why 39 is the hard one.',
      blocks: [
        { t: 'p', text: 'Punjabi numbers up to twenty are learned individually. After that they follow a pattern, but an irregular one — each decade has its own quirks, so most learners memorise rather than derive.' },
        { t: 'h', text: 'One to ten' },
        { t: 'pair', gurmukhi: 'ਇੱਕ', latin: 'ikk', english: 'one' },
        { t: 'pair', gurmukhi: 'ਦੋ', latin: 'do', english: 'two' },
        { t: 'pair', gurmukhi: 'ਤਿੰਨ', latin: 'tinn', english: 'three' },
        { t: 'pair', gurmukhi: 'ਚਾਰ', latin: 'chaar', english: 'four' },
        { t: 'pair', gurmukhi: 'ਪੰਜ', latin: 'panj', english: 'five', note: 'as in Punjab — "five waters"' },
        { t: 'pair', gurmukhi: 'ਛੇ', latin: 'chhe', english: 'six' },
        { t: 'pair', gurmukhi: 'ਸੱਤ', latin: 'satt', english: 'seven' },
        { t: 'pair', gurmukhi: 'ਅੱਠ', latin: 'atth', english: 'eight' },
        { t: 'pair', gurmukhi: 'ਨੌਂ', latin: 'naun', english: 'nine' },
        { t: 'pair', gurmukhi: 'ਦਸ', latin: 'das', english: 'ten' },
        { t: 'h', text: 'The tens' },
        { t: 'pair', gurmukhi: 'ਵੀਹ', latin: 'veeh', english: 'twenty' },
        { t: 'pair', gurmukhi: 'ਤੀਹ', latin: 'teeh', english: 'thirty' },
        { t: 'pair', gurmukhi: 'ਚਾਲ਼ੀ', latin: 'chaali', english: 'forty' },
        { t: 'pair', gurmukhi: 'ਪੰਜਾਹ', latin: 'panjaah', english: 'fifty' },
        { t: 'pair', gurmukhi: 'ਸੌ', latin: 'sau', english: 'hundred' },
        { t: 'tip', text: 'The number before each ten is where it gets awkward: 39 is ਉਨਤਾਲ਼ੀ (unataali), which looks nothing like 40. Punjabi shares this with Hindi and it defeats most learners — including native speakers doing mental arithmetic.' }
      ]
    },

    {
      id: 'kinship-system',
      title: 'Why Punjabi has so many words for "uncle"',
      emoji: '👪',
      minutes: 4,
      summary: 'English collapses relatives Punjabi keeps carefully apart.',
      blocks: [
        { t: 'p', text: 'English says "uncle" and leaves you guessing. Punjabi tells you immediately whether the relative is on your father\'s side or your mother\'s, and whether he is older or younger than your parent. This is not decoration — it tells you what the relationship obliges.' },
        { t: 'h', text: "Your father's side" },
        { t: 'pair', gurmukhi: 'ਤਾਇਆ', latin: 'taaiaa', english: "father's ELDER brother", note: 'senior to your father; treated with deference' },
        { t: 'pair', gurmukhi: 'ਚਾਚਾ', latin: 'chaacha', english: "father's YOUNGER brother", note: 'more relaxed, often closer' },
        { t: 'pair', gurmukhi: 'ਭੂਆ', latin: 'bhooaa', english: "father's sister" },
        { t: 'h', text: "Your mother's side" },
        { t: 'pair', gurmukhi: 'ਮਾਮਾ', latin: 'maama', english: "mother's brother", note: 'has formal duties at your wedding' },
        { t: 'pair', gurmukhi: 'ਮਾਸੀ', latin: 'maasi', english: "mother's sister", note: 'proverbially indulgent' },
        { t: 'h', text: 'The grandparents' },
        { t: 'pair', gurmukhi: 'ਦਾਦਾ / ਦਾਦੀ', latin: 'daada / daadi', english: "father's parents" },
        { t: 'pair', gurmukhi: 'ਨਾਨਾ / ਨਾਨੀ', latin: 'naana / naani', english: "mother's parents" },
        { t: 'tip', text: 'Their villages have names too: ਦਾਦਕੇ is your father\'s ancestral village, ਨਾਨਕੇ your mother\'s. Summers at the ਨਾਨਕੇ, being thoroughly spoiled, are a near-universal Punjabi childhood memory.' }
      ]
    },

    {
      id: 'everyday-verbs',
      title: 'Ten verbs that carry the language',
      emoji: '🗣️',
      minutes: 4,
      summary: 'Learn these and you can hold a conversation about most of daily life.',
      blocks: [
        { t: 'p', text: 'Punjabi verbs come at the end of the sentence. The dictionary form ends in ‑ਣਾ or ‑ਨਾ, and these ten cover an enormous amount of ordinary speech.' },
        { t: 'pair', gurmukhi: 'ਖਾਣਾ', latin: 'khaana', english: 'to eat', note: 'ਰੋਟੀ ਖਾ ਲੈ — eat something' },
        { t: 'pair', gurmukhi: 'ਪੀਣਾ', latin: 'peena', english: 'to drink', note: 'ਚਾਹ ਪੀ ਲੈ — have some tea' },
        { t: 'pair', gurmukhi: 'ਜਾਣਾ', latin: 'jaana', english: 'to go', note: 'ਖੇਤ ਜਾਣਾ ਹੈ — I have to go to the field' },
        { t: 'pair', gurmukhi: 'ਆਉਣਾ', latin: 'aauna', english: 'to come', note: 'also "to know how": ਮੈਨੂੰ ਪੰਜਾਬੀ ਆਉਂਦੀ ਹੈ' },
        { t: 'pair', gurmukhi: 'ਕਰਨਾ', latin: 'karna', english: 'to do', note: 'pairs with countless nouns' },
        { t: 'pair', gurmukhi: 'ਬੋਲਣਾ', latin: 'bolna', english: 'to speak' },
        { t: 'pair', gurmukhi: 'ਸੁਣਨਾ', latin: 'sunana', english: 'to listen', note: 'ਗੱਲ ਸੁਣ — listen here' },
        { t: 'pair', gurmukhi: 'ਦੇਖਣਾ', latin: 'dekhna', english: 'to see' },
        { t: 'pair', gurmukhi: 'ਬਹਿਣਾ', latin: 'behna', english: 'to sit', note: 'ਬਹਿ ਜਾ — sit down; very theth' },
        { t: 'pair', gurmukhi: 'ਲੈਣਾ', latin: 'laina', english: 'to take' },
        { t: 'tip', text: 'Notice how often "ਲੈ" is tacked onto the end — ਖਾ ਲੈ, ਪੀ ਲੈ, ਸੁਣ ਲੈ. It softens a command into an offer, which is why Punjabi hospitality sounds insistent rather than rude.' }
      ]
    },

    {
      id: 'dialects',
      title: 'The four dialects',
      emoji: '🗺️',
      minutes: 4,
      summary: 'Majhi, Malwai, Doabi, Puadhi — and which one you are probably learning.',
      blocks: [
        { t: 'p', text: 'Punjabi is not uniform. The dialect a speaker uses places them geographically almost immediately, and the differences are in everyday words, not obscure ones.' },
        { t: 'h', text: 'Majhi — ਮਾਝੀ' },
        { t: 'p', text: 'Amritsar, Gurdaspur, Lahore. Treated as the literary standard, and the basis of written Punjabi and most broadcasting.' },
        { t: 'h', text: 'Malwai — ਮਲਵਈ' },
        { t: 'p', text: 'South of the Sutlej: Ludhiana, Bathinda, Ferozepur. Blunter and earthier, and the source of most of the deep theth vocabulary in this app — ਸੱਥ, ਟੱਬਰ, ਖਿਝ, ਅਣਖ.' },
        { t: 'h', text: 'Doabi — ਦੁਆਬੀ' },
        { t: 'p', text: 'Between the Beas and Sutlej: Jalandhar, Hoshiarpur. Heavily represented in the diaspora, so many British and Canadian Punjabis are speaking Doabi without knowing the name.' },
        { t: 'h', text: 'Puadhi — ਪੁਆਧੀ' },
        { t: 'p', text: 'The south-east, towards Patiala, Ropar and Chandigarh, shading into Haryanvi at the edges.' },
        { t: 'tip', text: 'Every word in this app is tagged with its dialect. If a word is marked Malwai and your family is from Jalandhar, your grandparents may have used something different — which is exactly the kind of word worth adding.' }
      ]
    },

    {
      id: 'gurmukhi-sounds',
      title: 'Four sounds English does not have',
      emoji: '👂',
      minutes: 5,
      summary: 'Retroflex l, the addak, nasal vowels, and aspiration.',
      blocks: [
        { t: 'p', text: 'Most Punjabi sounds have rough English equivalents. Four do not, and they are the ones that give learners away.' },
        { t: 'h', text: '1. ਲ਼ — the retroflex l' },
        { t: 'p', text: 'Tongue curled back against the roof of the mouth. Distinct from ordinary ਲ, and it changes meaning.' },
        { t: 'pair', gurmukhi: 'ਹਲ਼', latin: 'hal', english: 'plough', note: 'retroflex — not the same as ਹਲ' },
        { t: 'pair', gurmukhi: 'ਵੇਲ਼ਾ', latin: 'vela', english: 'time, occasion' },
        { t: 'h', text: '2. ੱ — the addak' },
        { t: 'p', text: 'Doubles the consonant that FOLLOWS it. Skipping it is the single most common learner error, and it makes words unrecognisable.' },
        { t: 'pair', gurmukhi: 'ਪਤਾ', latin: 'pataa', english: 'address, knowledge' },
        { t: 'pair', gurmukhi: 'ਪੱਤਾ', latin: 'pattaa', english: 'leaf', note: 'same letters, one addak, different word' },
        { t: 'h', text: '3. ੰ and ਂ — nasalisation' },
        { t: 'p', text: 'The vowel goes through the nose. Not optional decoration — ਮੀਂਹ without the nasal is not a word.' },
        { t: 'pair', gurmukhi: 'ਮੀਂਹ', latin: 'meenh', english: 'rain' },
        { t: 'pair', gurmukhi: 'ਗਾਂ', latin: 'gaan', english: 'cow' },
        { t: 'h', text: '4. Aspiration' },
        { t: 'p', text: 'ਕ / ਖ, ਪ / ਫ, ਤ / ਥ differ only by a puff of air. English speakers hear them as the same letter; Punjabi speakers hear two different words.' },
        { t: 'pair', gurmukhi: 'ਕਾਲ਼ਾ', latin: 'kaala', english: 'black' },
        { t: 'pair', gurmukhi: 'ਖਾਲ਼ਾ', latin: 'khaala', english: 'irrigation channel' },
        { t: 'tip', text: 'Use the 🔊 button on any word in the app. If a contributor has recorded it, you will hear a real speaker rather than a synthesiser — which for these four sounds makes all the difference.' }
      ]
    },

    {
      id: 'politeness',
      title: 'Being polite in Punjabi',
      emoji: '🙏',
      minutes: 3,
      summary: 'ਤੂੰ, ਤੁਸੀਂ, and the ਜੀ that fixes almost anything.',
      blocks: [
        { t: 'p', text: 'Punjabi has two words for "you", and choosing wrongly is the fastest way to give offence.' },
        { t: 'pair', gurmukhi: 'ਤੂੰ', latin: 'toon', english: 'you — informal', note: 'children, close friends, younger family' },
        { t: 'pair', gurmukhi: 'ਤੁਸੀਂ', latin: 'tuseen', english: 'you — respectful', note: 'elders, strangers, anyone senior' },
        { t: 'p', text: 'When unsure, use ਤੁਸੀਂ. Being too formal is mildly amusing; being too familiar with an elder is genuinely rude.' },
        { t: 'h', text: 'The universal softener' },
        { t: 'p', text: 'ਜੀ attaches to almost anything and makes it respectful. ਹਾਂ ਜੀ (yes), ਭਰਾ ਜੀ (brother), ਬਾਪੂ ਜੀ (father). It can also stand alone as a polite "yes?" when someone calls you.' },
        { t: 'h', text: 'Useful courtesies' },
        { t: 'pair', gurmukhi: 'ਮਿਹਰਬਾਨੀ', latin: 'meharbaani', english: 'thank you', note: 'warmer than the formal ਧੰਨਵਾਦ' },
        { t: 'pair', gurmukhi: 'ਮਾਫ਼ ਕਰਨਾ', latin: 'maaf karna', english: 'sorry / excuse me' },
        { t: 'pair', gurmukhi: 'ਕੋਈ ਗੱਲ ਨਹੀਂ', latin: 'koee gall naheen', english: "it's nothing / never mind" },
        { t: 'tip', text: 'Touching an elder\'s feet — ਪੈਰੀਂ ਹੱਥ ਲਾਉਣਾ — is a daily gesture rather than a ceremonial one. The reply is a blessing: ਜਿਊਂਦਾ ਰਹੁ, may you live long.' }
      ]
    },

    {
      id: 'hospitality',
      title: 'How to be fed in a Punjabi house',
      emoji: '🍲',
      minutes: 3,
      summary: 'You are going to eat. This lesson is about accepting gracefully.',
      blocks: [
        { t: 'p', text: 'Refusing food in a Punjabi home is not treated as politeness. It is treated as a problem to be solved, usually by bringing more food.' },
        { t: 'h', text: 'What you will hear' },
        { t: 'pair', gurmukhi: 'ਆਓ ਜੀ, ਬਹਿ ਜਾਓ', latin: 'aao ji, beh jaao', english: 'Come in, sit down' },
        { t: 'pair', gurmukhi: 'ਚਾਹ ਪੀ ਕੇ ਜਾਈਂ', latin: 'chaah pee ke jaaeen', english: 'Have tea before you go', note: 'not really a question' },
        { t: 'pair', gurmukhi: 'ਰੋਟੀ ਖਾ ਲਓ', latin: 'roti khaa lao', english: 'Eat something' },
        { t: 'pair', gurmukhi: 'ਹੋਰ ਲਓ', latin: 'hor lao', english: 'Take some more', note: 'expect this several times' },
        { t: 'h', text: 'What to say back' },
        { t: 'pair', gurmukhi: 'ਬੜਾ ਸੁਆਦ ਬਣਿਆ ਹੈ', latin: 'barhaa suaad baniaa hai', english: 'This is delicious', note: 'the praise a cook wants' },
        { t: 'pair', gurmukhi: 'ਬਸ, ਢਿੱਡ ਭਰ ਗਿਆ', latin: 'bas, dhidd bhar giaa', english: 'Enough, I am full' },
        { t: 'pair', gurmukhi: 'ਮਿਹਰਬਾਨੀ ਜੀ', latin: 'meharbaani ji', english: 'Thank you' },
        { t: 'tip', text: 'Saying you are full once will not work. Saying it warmly three times, while praising the food, generally will.' }
      ]
    },

    {
      id: 'untranslatable',
      title: 'Five words English cannot translate',
      emoji: '💛',
      minutes: 4,
      summary: 'ਹੇਰਵਾ, ਚਾਅ, ਅਣਖ, ਸ਼ਰੀਕ, ਰੌਣਕ.',
      blocks: [
        { t: 'p', text: 'Some words carry a whole way of seeing things. These five have no clean English equivalent, and learning them tells you more about Punjabi culture than a hundred nouns would.' },
        { t: 'pair', gurmukhi: 'ਹੇਰਵਾ', latin: 'herva', english: 'the ache of separation', note: 'closer to Portuguese saudade than to homesickness — the physical pain of missing a person, a village, a life' },
        { t: 'pair', gurmukhi: 'ਚਾਅ', latin: 'chaa', english: 'eager anticipatory delight', note: 'the fizz before something long-awaited; bigger than eagerness, warmer than excitement' },
        { t: 'pair', gurmukhi: 'ਅਣਖ', latin: 'anakh', english: 'self-respect that refuses humiliation', note: 'a central Punjabi value, and the reason behind a great many decisions both admirable and disastrous' },
        { t: 'pair', gurmukhi: 'ਸ਼ਰੀਕ', latin: 'shareek', english: 'kin who are also rivals', note: 'the cousins you share ancestral land with and compete against; both words at once, permanently' },
        { t: 'pair', gurmukhi: 'ਰੌਣਕ', latin: 'raunak', english: 'the liveliness of a full house', note: 'light, noise and bustle together — and its absence is one of the saddest things a Punjabi can describe' },
        { t: 'tip', text: 'If you know a word like this that the app is missing, add it. Words with no English equivalent are exactly the ones that disappear first, because nothing else is holding them in place.' }
      ]
    },

    {
      id: 'contributing',
      title: 'How to add a word well',
      emoji: '➕',
      minutes: 3,
      summary: 'What makes a contribution useful to the next person.',
      blocks: [
        { t: 'p', text: 'This app is built on words contributed by speakers. A good entry takes two minutes and helps someone you will never meet.' },
        { t: 'h', text: 'What makes an entry good' },
        { t: 'p', text: 'A real example sentence matters more than a perfect definition. "ਖੁਰਲੀ — feeding trough" is fine; "ਮੱਝਾਂ ਖੁਰਲੀ ਤੇ ਖੜ੍ਹੀਆਂ ਨੇ" teaches how the word actually behaves in a sentence.' },
        { t: 'p', text: 'Say where you heard it in the notes. "My grandmother in Bathinda said this" is genuinely useful to a reviewer deciding whether a word is Malwai or general.' },
        { t: 'h', text: 'Record your voice if you can' },
        { t: 'p', text: 'Speech synthesisers get theth pronunciation wrong — the retroflex ਲ਼, the addak, the nasal vowels. A recording of a real speaker is the single most valuable thing you can add, and it cannot be generated by any machine.' },
        { t: 'h', text: 'What happens next' },
        { t: 'p', text: 'Your word enters the review queue as pending. Other speakers confirm or doubt it, and only once it clears does anyone learn it. You cannot vote on your own word — someone else has to check it.' },
        { t: 'tip', text: 'If a word is marked disputed, that is not a rejection. Read the reviewers\' notes, fix it, and resubmit — the old votes are cleared so it gets a fresh hearing.' }
      ]
    }

  ];

})(window);
