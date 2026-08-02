/* ══════════════════════════════════════════════════
   Bolee — Phrasebook  →  window.BOLEE_PHRASES
   ──────────────────────────────────────────────────
   Everyday Punjabi you would actually say, grouped by
   situation. Shipped as static data, so the phrasebook
   and the local rung of the translator both work with
   no key and no network.
   ══════════════════════════════════════════════════ */

(function (g) {
  'use strict';

  var GROUPS = [
    { id: 'greeting', label: 'Greetings & manners', emoji: '🙏' },
    { id: 'family',   label: 'Family talk',         emoji: '👪' },
    { id: 'village',  label: 'Village life',        emoji: '🌾' },
    { id: 'food',     label: 'Food & hospitality',  emoji: '🍲' },
    { id: 'market',   label: 'Market & money',      emoji: '🛒' },
    { id: 'feeling',  label: 'Feelings & wishes',   emoji: '💛' },
    { id: 'travel',   label: 'Getting around',      emoji: '🚌' }
  ];

  // [gurmukhi, latin, english, group, note]
  var RAW = [
    // ── greetings & manners ──
    ['ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', 'sat sri akaal', 'Hello / goodbye (Sikh greeting)', 'greeting', 'Works for both arriving and leaving, any time of day.'],
    ['ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਹਿ', 'vaheguru ji ka khalsa, vaheguru ji ki fateh', 'The formal Sikh greeting', 'greeting', 'More formal than sat sri akaal; the second half is the reply.'],
    ['ਕੀ ਹਾਲ ਹੈ?', 'ki haal hai?', 'How are you?', 'greeting', ''],
    ['ਠੀਕ ਹਾਂ, ਤੁਸੀਂ ਸੁਣਾਓ', 'theek haan, tuseen sunaao', "I'm well — and you?", 'greeting', 'Literally "you tell" — the standard way to hand the question back.'],
    ['ਸਭ ਠੀਕ ਹੈ', 'sabh theek hai', 'Everything is fine', 'greeting', ''],
    ['ਰੱਬ ਦਾ ਸ਼ੁਕਰ ਹੈ', 'rabb da shukar hai', 'Thank God', 'greeting', 'Punctuates ordinary conversation constantly.'],
    ['ਮਿਹਰਬਾਨੀ', 'meharbaani', 'Thank you', 'greeting', 'Warmer than the more formal ਧੰਨਵਾਦ.'],
    ['ਕੋਈ ਗੱਲ ਨਹੀਂ', 'koee gall naheen', "It's nothing / never mind", 'greeting', 'Used both for "you\'re welcome" and "don\'t worry about it".'],
    ['ਮਾਫ਼ ਕਰਨਾ', 'maaf karna', 'Sorry / excuse me', 'greeting', ''],
    ['ਤੁਹਾਡਾ ਨਾਂ ਕੀ ਹੈ?', 'tuhaada naan ki hai?', 'What is your name?', 'greeting', ''],
    ['ਮੇਰਾ ਨਾਂ ... ਹੈ', 'mera naan ... hai', 'My name is ...', 'greeting', ''],
    ['ਤੇਰਾ ਪਿੰਡ ਕਿਹੜਾ?', 'tera pind kehrhaa?', 'Which village are you from?', 'greeting', 'Among the first things one Punjabi asks another.'],
    ['ਫੇਰ ਮਿਲਾਂਗੇ', 'pher milaange', 'See you again', 'greeting', ''],
    ['ਆਓ ਜੀ, ਬਹਿ ਜਾਓ', 'aao ji, beh jaao', 'Come in, please sit', 'greeting', ''],

    // ── family ──
    ['ਬੇਬੇ ਕਿੱਥੇ ਹੈ?', 'bebe kitthe hai?', 'Where is mother?', 'family', ''],
    ['ਬਾਪੂ ਖੇਤ ਗਿਆ ਹੋਇਆ ਹੈ', 'baapu khet giaa hoiaa hai', 'Father has gone to the field', 'family', ''],
    ['ਘਰ ਵਿੱਚ ਸਭ ਠੀਕ ਹੈ?', 'ghar vich sabh theek hai?', 'Is everyone well at home?', 'family', 'Asked before anything else.'],
    ['ਨਿਆਣੇ ਕਿਵੇਂ ਨੇ?', 'niaane kiven ne?', 'How are the children?', 'family', ''],
    ['ਵੱਡਿਆਂ ਦੀ ਅਸੀਸ ਲੈ', 'vaddiaan di asees lai', "Take your elders' blessing", 'family', ''],
    ['ਪੁੱਤ, ਰੋਟੀ ਖਾ ਲੈ', 'putt, roti khaa lai', 'Son, have something to eat', 'family', 'ਪੁੱਤ is used affectionately for any young person.'],
    ['ਮੈਂ ਪੇਕੇ ਜਾ ਰਹੀ ਹਾਂ', 'main peke jaa rahi haan', "I'm going to my parents' home", 'family', 'Said by a married woman.'],
    ['ਸਾਰਾ ਟੱਬਰ ਆਇਆ ਹੋਇਆ ਹੈ', 'saara tabbar aaiaa hoiaa hai', 'The whole household has come', 'family', ''],
    ['ਵਿਆਹ ਕਦੋਂ ਹੈ?', 'viaah kadon hai?', 'When is the wedding?', 'family', ''],
    ['ਮਾਂ ਪਿਓ ਦੀ ਸੇਵਾ ਕਰ', 'maan pio di seva kar', 'Look after your parents', 'family', ''],
    ['ਭਰਾ ਜੀ, ਗੱਲ ਸੁਣੋ', 'bhraa ji, gall suno', 'Brother, listen a moment', 'family', 'Polite way to address a man of similar age.'],

    // ── village life ──
    ['ਕਿੱਥੇ ਚੱਲਿਆਂ?', 'kitthe challiaan?', 'Where are you off to?', 'village', ''],
    ['ਖੇਤ ਨੂੰ ਜਾ ਰਿਹਾ ਹਾਂ', 'khet nu jaa rihaa haan', "I'm going to the field", 'village', ''],
    ['ਪੱਠੇ ਵੱਢਣੇ ਨੇ', 'patthe vaddhane ne', 'I have to cut fodder', 'village', ''],
    ['ਡੰਗਰਾਂ ਨੂੰ ਪਾਣੀ ਪਿਆ ਦੇ', 'dangraan nu paani piaa de', 'Give the cattle water', 'village', ''],
    ['ਮੱਝ ਸੂ ਗਈ', 'majjh soo gaee', 'The buffalo has calved', 'village', 'Genuine good news in a dairy household.'],
    ['ਮੋਟਰ ਚਲਾ ਦੇ', 'motar chalaa de', 'Start the tubewell', 'village', 'ਮੋਟਰ means the tubewell pump specifically.'],
    ['ਫ਼ਸਲ ਕਿਵੇਂ ਹੈ?', 'fasal kiven hai?', 'How is the crop?', 'village', ''],
    ['ਮੀਂਹ ਪੈ ਗਿਆ, ਬੜਾ ਚੰਗਾ ਹੋਇਆ', 'meenh pai giaa, barhaa changa hoiaa', 'It rained — that is very good', 'village', ''],
    ['ਸੱਥ ਵਿੱਚ ਬੈਠੇ ਨੇ', 'sath vich baithe ne', 'They are sitting at the village gathering', 'village', ''],
    ['ਵਾਢੀ ਸ਼ੁਰੂ ਹੋ ਗਈ', 'vaadhi shuroo ho gaee', 'The harvest has started', 'village', ''],
    ['ਧੁੱਪ ਬੜੀ ਤਿੱਖੀ ਹੈ', 'dhupp barhi tikkhi hai', 'The sun is very fierce', 'village', ''],
    ['ਛਾਂ ਵਿੱਚ ਬਹਿ ਜਾ', 'chhaan vich beh ja', 'Sit in the shade', 'village', ''],
    ['ਮੰਜਾ ਡਾਹ ਦੇ', 'manja daah de', 'Set out the cot', 'village', 'The basic gesture of welcome.'],

    // ── food & hospitality ──
    ['ਰੋਟੀ ਖਾ ਲਓ', 'roti khaa lao', 'Please eat', 'food', 'You will not be allowed to refuse.'],
    ['ਭੁੱਖ ਲੱਗੀ ਹੈ', 'bhukkh laggi hai', 'I am hungry', 'food', 'Hunger attaches to you rather than being possessed.'],
    ['ਪਿਆਸ ਲੱਗੀ ਹੈ', 'piaas laggi hai', 'I am thirsty', 'food', ''],
    ['ਪਾਣੀ ਪਿਆ ਦਿਓ', 'paani piaa dio', 'Please give me water', 'food', ''],
    ['ਚਾਹ ਪੀ ਕੇ ਜਾਈਂ', 'chaah pee ke jaaeen', 'Have tea before you go', 'food', 'Refusing is close to an insult.'],
    ['ਬੜਾ ਸੁਆਦ ਬਣਿਆ ਹੈ', 'barhaa suaad baniaa hai', 'This is delicious', 'food', 'The highest praise for cooking.'],
    ['ਹੋਰ ਲਓ', 'hor lao', 'Take some more', 'food', 'Expect to hear this many times.'],
    ['ਬਸ, ਢਿੱਡ ਭਰ ਗਿਆ', 'bas, dhidd bhar giaa', 'Enough, I am full', 'food', ''],
    ['ਲੂਣ ਘੱਟ ਹੈ', 'loon ghatt hai', 'It needs more salt', 'food', ''],
    ['ਸਾਗ ਬਣਾਇਆ ਹੈ', 'saag banaaiaa hai', 'I have made saag', 'food', 'An invitation in itself.'],
    ['ਲੱਸੀ ਦਾ ਗਲਾਸ ਪੀ ਲੈ', 'lassi da galaas pee lai', 'Have a glass of lassi', 'food', ''],
    ['ਮੈਂ ਸ਼ਾਕਾਹਾਰੀ ਹਾਂ', 'main shaakaahaari haan', 'I am vegetarian', 'food', ''],
    ['ਮਿਰਚ ਘੱਟ ਪਾਈਓ', 'mirach ghatt paaio', 'Please use less chilli', 'food', ''],

    // ── market & money ──
    ['ਕਿੰਨੇ ਦਾ ਹੈ?', 'kinne da hai?', 'How much is it?', 'market', ''],
    ['ਬੜਾ ਮਹਿੰਗਾ ਹੈ', 'barhaa mehinga hai', 'That is very expensive', 'market', ''],
    ['ਕੁਝ ਘੱਟ ਕਰੋ', 'kujh ghatt karo', 'Bring the price down a little', 'market', ''],
    ['ਪੈਸੇ ਨਹੀਂ ਹੈਗੇ', 'paise naheen haige', 'I do not have money', 'market', 'ਹੈਗੇ is a very Punjabi emphatic form of "is".'],
    ['ਇੱਕ ਕਿੱਲੋ ਦੇ ਦਿਓ', 'ikk killo de dio', 'Give me one kilo', 'market', ''],
    ['ਹੋਰ ਕੁਝ ਚਾਹੀਦਾ ਹੈ?', 'hor kujh chaaheeda hai?', 'Do you need anything else?', 'market', ''],
    ['ਮੰਡੀ ਜਾਣਾ ਹੈ', 'mandi jaana hai', 'I have to go to the market', 'market', 'ਮੰਡੀ is the grain market specifically.'],
    ['ਹਿਸਾਬ ਕਰ ਦਿਓ', 'hisaab kar dio', 'Settle the account', 'market', ''],
    ['ਉਧਾਰ ਨਹੀਂ ਦਿੰਦੇ', 'udhaar naheen dinde', 'We do not give credit', 'market', ''],

    // ── feelings & wishes ──
    ['ਬਹੁਤ ਵਧੀਆ!', 'bahut vadhiaa!', 'Excellent!', 'feeling', ''],
    ['ਸ਼ਾਬਾਸ਼', 'shaabaash', 'Well done', 'feeling', 'What you say to a child who has done well.'],
    ['ਫ਼ਿਕਰ ਨਾ ਕਰ', 'fikar naa kar', 'Do not worry', 'feeling', ''],
    ['ਹੌਸਲਾ ਰੱਖ', 'hausla rakkh', 'Keep your courage', 'feeling', 'Said to someone facing something hard.'],
    ['ਸਬਰ ਕਰ', 'sabar kar', 'Be patient', 'feeling', 'Offered as comfort at a loss.'],
    ['ਮੈਨੂੰ ਤੇਰੀ ਯਾਦ ਆਉਂਦੀ ਹੈ', 'mainu teri yaad aaundi hai', 'I miss you', 'feeling', 'Literally: your memory comes to me.'],
    ['ਸਾਨੂੰ ਤੇਰੇ ਤੇ ਮਾਣ ਹੈ', 'saanu tere te maan hai', 'We are proud of you', 'feeling', ''],
    ['ਰੱਬ ਸੁੱਖ ਰੱਖੇ', 'rabb sukkh rakkhe', 'May God keep you well', 'feeling', ''],
    ['ਜਿਊਂਦਾ ਰਹੁ', 'jiunda rahu', 'May you live long', 'feeling', 'An elder\'s blessing to a younger person.'],
    ['ਬੜਾ ਚਾਅ ਹੈ', 'barhaa chaa hai', 'I am really looking forward to it', 'feeling', 'ਚਾਅ has no exact English equivalent.'],
    ['ਦਿਲ ਨਹੀਂ ਲੱਗਦਾ', 'dil naheen laggda', 'I cannot settle / I feel unsettled', 'feeling', ''],
    ['ਗੁੱਸਾ ਨਾ ਕਰ', 'gussa naa kar', 'Do not be angry', 'feeling', ''],

    // ── getting around ──
    ['ਰਾਹ ਦੱਸ ਦਿਓ', 'raah dass dio', 'Please show me the way', 'travel', ''],
    ['ਕਿੰਨੀ ਦੂਰ ਹੈ?', 'kinni door hai?', 'How far is it?', 'travel', ''],
    ['ਸਿੱਧਾ ਚੱਲੇ ਜਾਓ', 'siddhaa challe jaao', 'Go straight on', 'travel', ''],
    ['ਖੱਬੇ ਮੁੜ ਜਾਓ', 'khabbe murh jaao', 'Turn left', 'travel', ''],
    ['ਸੱਜੇ ਮੁੜ ਜਾਓ', 'sajje murh jaao', 'Turn right', 'travel', ''],
    ['ਬੱਸ ਕਦੋਂ ਆਊਗੀ?', 'bass kadon aaoogi?', 'When will the bus come?', 'travel', ''],
    ['ਅੱਡਾ ਕਿੱਥੇ ਹੈ?', 'adda kitthe hai?', 'Where is the bus stand?', 'travel', 'ਅੱਡਾ is the standard word for a bus stand.'],
    ['ਮੈਂ ਰਾਹ ਭੁੱਲ ਗਿਆ', 'main raah bhull giaa', 'I have lost my way', 'travel', ''],
    ['ਥੋੜ੍ਹਾ ਹੌਲੀ ਬੋਲੋ', 'thorhaa hauli bolo', 'Please speak a little slower', 'travel', 'Useful when your Punjabi is still coming along.'],
    ['ਮੈਨੂੰ ਪੰਜਾਬੀ ਥੋੜ੍ਹੀ ਆਉਂਦੀ ਹੈ', 'mainu punjabi thorhi aaundi hai', 'I speak a little Punjabi', 'travel', ''],
    ['ਸਮਝ ਨਹੀਂ ਆਈ', 'samajh naheen aaee', 'I did not understand', 'travel', ''],
    ['ਫੇਰ ਤੋਂ ਕਹੋ', 'pher ton kaho', 'Say that again', 'travel', '']
  ];

  var PHRASES = RAW.map(function (p, i) {
    return {
      id: 'ph-' + String(i + 1).padStart(3, '0'),
      gurmukhi: p[0],
      latin: p[1],
      english: p[2],
      group: p[3],
      note: p[4] || ''
    };
  });

  g.BOLEE_PHRASES = PHRASES;
  g.BOLEE_PHRASE_GROUPS = GROUPS;

})(window);
