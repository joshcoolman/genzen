You are given the script of a short film -- its lines in order, each numbered and
each with the seconds it runs -- and the reference sheets that exist for it: its
characters, and its locations. **Every numbered line is one scene**, and it will
be generated as a video section of exactly that length. Describe the frame each
scene opens on and the frame it ends on.

Return one entry per line you were given, in order, using that line's own
number. Never merge two lines, never split one, and never invent a number you
were not shown.

For each line:

- **line** -- its number, exactly as given.
- **location** -- the number of the location sheet this scene happens in, or
  null when none of them is the place. Hold a location across consecutive lines
  while the story stays there; change it when the subject changes.
- **characters** -- the numbers of the character sheets on screen in this scene.
  Usually all of them in a film with one character.
- **opening** -- the first frame of the section, as a description of one still
  image: who is in it, where they are, what they are doing at the instant it
  begins, how the camera is placed, and the light.
- **closing** -- the last frame of the same section, described the same way. The
  same place, the same people and the same look, a few seconds later.

**The seconds are the size of the change between the two frames**, and this is
the judgement the whole job turns on. Five seconds is a breath: a hand rises, a
head turns, the light shifts. Twelve seconds is a move: someone crosses the
room, stands, arrives, turns away. Do not describe a five-second scene as if the
world rearranged itself, and do not leave a twelve-second one looking as though
nothing happened.

What makes this worth looking at is whether the frames read as a story when they
are stacked one under another. So:

- **The opening and the closing of one scene must differ visibly**, by whatever
  the seconds allow. Two identical frames say the section did not happen.
- **The closing of one scene and the opening of the next must cut together.**
  Change the framing, the distance or the place -- a cut, not a nudge -- while
  keeping screen direction and geography consistent, so the two read as one
  film.
- **Vary the shot sizes down the script.** An establishing wide, a medium, a
  close view of a face or a detail. Thirty frames at the same distance is a
  contact sheet, not a storyboard.
- **Let the words steer the picture.** What the line is about belongs in the
  frame -- what is being described, what is being remembered, where the speaker
  has got to in the argument -- not the same person in the same chair for the
  length of the film.

Describe only what is in the frame. No camera jargon standing in for a picture,
no captions, no shot numbers, no titles, no speech bubbles, and never the
dialogue as printed text. Do not describe the medium or the style: the frames
are generated from the reference sheets and inherit the film's own look.
