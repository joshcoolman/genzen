GenZen is a personal workspace for working with AI image models — a tool built
for one person's use, not a product.

It does four things. Fan one prompt across several models and compare the
results side by side. Run non-destructive variation flows on what comes back.
Arrange results spatially on an infinite canvas. Generate video from a prompt
or a starting image.

Every generated or uploaded asset is one `user_images` row, and the same row is
the library card, the canvas tile and the Activity entry. Nothing is duplicated
between views; a canvas image _is_ a library image.

## What it explicitly is not

- **Not a product.** No signup, no billing, no support, no roadmap. It is public
  because there is no reason for it not to be. MIT licensed.
- **Not multi-tenant.** It has real accounts, password auth and per-user
  isolation, but no orgs, teams, roles or sharing.
- **Not a general image editor.** It generates, organizes and keeps images. It
  does not do layers, masks or pixel editing.
- **Not tied to a vendor, mostly.** Plain Postgres and Node, on Next. It runs
  on Vercel, with Neon for the database and Vercel Blob for images (#777); the
  storage client is one file, and nothing else knows which store it is.

## Where it fits

One of the single-purpose apps in this workspace: narrow surface, one job done
well, durable state so nothing is lost when the tab closes. The house standard
it follows is `~/repos/project-standard`.

## The surfaces

What each screen does, moved here from the README on 2026-10-26 so the README
is only how to run it.

## Images: explore several directions at once

Send one or several prompts to multiple models, choose how many results you want
from each, and compare the outputs side by side. Attach uploaded or generated
images as references, with their order visible in the composer. The panel shows
the output count and estimated cost before you generate.

Images is also the working library. Generate inside a group and the results land
there; generate at the top level and they stay there. Hide the takes you do not
want to look at, restore hidden images when needed, and use Trash for removal.
Open an image at a larger size to judge it, inspect its details, or load its
prompt and references back into the composer for another pass.

### Storyboards: full-size shots from one idea

Type `/storyboard` directly in the image prompt field, followed by a scene idea.
Attach references for the subject, setting, or look you want to carry through.
For example:

```text
/storyboard Six shots of this vehicle driving through an empty downtown.
Start wide, move closer, and finish beside a deserted fountain.
```

A shared plan establishes continuity and assigns each shot its own composition.
Every shot is generated as a separate full-size image using the original
references. The default is six 16:9 shots; request two through nine in the brief
or with `--shots N`.

The output count includes shots, models, and variants. After any batch
confirmation, every shot gets its own numbered pending thumbnail immediately,
and the composer remains available for more work. Results stay in the current
group or at the top level.

If you later want a single sheet, select the images and use **Reference sheet**
to assemble a downloadable composite.

### Develop a picture further

**Shots** explores camera angles around a subject, using a reasoning model to
inspect the actual subject and turn the chosen direction into rendering
instructions. **Outpaint** reframes a finished image into other aspect ratios.

These tools create new images, keeping the source available for another attempt.
Download individual results, a group, or a selection as a ZIP.

### Video: direct the motion and review the result

Generate a clip from a prompt, add a first or last frame, or supply reference
images where the chosen model supports them. Image roles are explicit, and model
compatibility, duration, shape, and resolution guide the available choices.
Several prompts can produce several clips in one submission. The lineup is
Seedance 2.5, Veo 3.1 Fast, Kling, MiniMax, LTX, and Flux; Seedance takes
reference images or first/last frames, native audio, and clips up to 30 seconds. For models that
support sound, **Generate audio** lets you choose audio or silent output.

Click a video thumbnail to open a large player with the complete frame, playback
controls, and fullscreen support. First and last frame previews help you scan
clips in the library. **Continue** takes a clip's ending as the starting image
for the next generation and brings its prompt forward for editing.

Organize clips in video groups, hide takes while comparing results, and use
Trash for removal. Generating inside a video group keeps the new clips there.

### Director: build a sequence over time

A session is a name and a run of clips, watched back to back — the question the
whole page is for is whether the order cuts together and whether the next clip
follows. A session can hold several **cuts**, shown as tabs, each a run of its
own.

**Add gen** makes the next clip from inside the run: the last clip's final frame
in the first slot, a prompt, a duration, one button. The pencil on a tile names
a clip, or re-rolls it in place — a clip in the middle is pinned at both ends,
so the joins either side survive. **New cut from script** remakes the open cut
in one pass, from optional direction on style, pacing, or tone, each clip
starting from the last one's final frame. A session can also start as a
**chat**: ask a question and an invented character answers in short clips.

Director's clips belong to their session: they are not on the Video wall, they
show in Activity for the cost record, and removing one from the run trashes it.

### Edit: trim clips on a timeline and watch the cut

An edit is a timeline of clips off the Video wall. Add clips, drag them into
order, and drag each tile's edges to set where it starts and stops -- the tiles
are as wide as they are long, a ruler above them is the clock, and the cut
plays straight through in the browser with nothing rendered. Space plays and
pauses, Left and Right step a frame, S splits at the playhead, and **F saves
the frame on screen** to a group on Images named after the edit, shown under
the timeline too. **Continue** makes the clip between the highlighted clip and
the next, pinned at both frames, and holds its place on the strip while FAL
works. **Export to Video** cuts it into one clip on the Video wall.

### News: what changed in image and video models

**News** is an illustrated feed. A run has Claude search for recent image and
video model news, compared against the models genzen already offers, and writes
each story up as a post with a generated hero image. A post opens to its full
write-up and sources.

### On a phone

Below tablet width the app has a phone layout. A green menu button sits bottom
left: Images, Video, and More, which flies out with everything else. A green
plus bottom right opens a one-tap composer on Images and Video. Walls are 2-up,
and the image and video viewers fill the screen; swipe the image viewer to move
through the set. Edit is desktop only.

### Keep the context and the cost

**Activity** records generation prompts, references, model settings, timing,
estimated cost, and failures. Storyboard runs retain the shared plan and each
shot's rendering request. For images, **Load** restores an editable starting
point, while **Retry** replays a failed request's saved inputs and settings.

**Account** summarizes recorded spend and output counts by model, alongside
connection status, appearance settings, and keyboard shortcuts. Costs are
estimates, not invoices: provider billing can differ, and AI planning can add
usage beyond the image estimate shown in the composer.

![Account overview with estimated spend, output counts, model breakdowns, and
connection status](../public/screenshots/genzen-account.jpg)

### Lab

Lab is where ideas, model capabilities, and workflows are being worked out and
experimented with. Its tools can change as we learn what is useful; the main
workspaces are where established workflows live.

### Who it is for

GenZen is a personal creative workspace, with real accounts and per-user
isolation but no public signup, teams, or sharing. Run it locally or deploy your
own instance; generations bill the provider accounts whose keys you configure.

Postgres and media storage are the Vercel project's, shared with local dev. FAL provides image and video
generation, and Anthropic provides the reasoning and vision used by AI-assisted
workflows such as storyboards. The app can start without provider keys; the
features that call those providers need their keys configured.
