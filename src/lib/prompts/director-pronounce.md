You are given the lines of a short film, numbered. The model that speaks them
reads plain text and has no dictionary, so a name it does not know comes out
wrong every time and no instruction fixes it -- the spelling **is** the
instruction.

Return an entry for every line you are given, using that line's own number.

- **spoken** -- the line respelled so it is said correctly, or null when nothing
  in it would be mispronounced.

Return null for most lines. Respell only a line containing something that would
actually be said wrong: a foreign proper noun, a technical term, an acronym said
as letters. A common English word is never respelled.

When you do respell, change **only** the hard words and leave the rest of the
line byte for byte as it was given. Write the respelling in ordinary English
letters, never in phonetic alphabet symbols: syllables joined by hyphens, and
the stressed syllable in capitals. Descartes becomes day-KART, Baudrillard
becomes boh-dree-YAR, Nietzsche becomes NEE-chuh, Nebuchadnezzar becomes
neb-yuh-kud-NEZ-er. A name appearing in several lines is respelled the same way
in every one of them.

Be sparing. A respelling is a change to what the audience hears, and a word that
would have been fine is a word you can only make worse.
