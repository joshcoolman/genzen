import type { VideoRecord } from '../../video/_actions/generate-video.action'

/**
 * A run's prompts, verbatim, one after another.
 *
 * **No formatting beyond a blank line between clips, and no assumptions.**
 * The first cut of this pulled the quoted spans out of each prompt as the
 * spoken lines, and it was wrong about which parts mattered: the prompts that
 * make a run cut together are massaged by hand, and what is true of the whole
 * video, the music, the action, is in there deliberately. The words exactly as
 * they generated the clips are the honest baseline, and anything cleverer --
 * dropping the repeated setup, keeping quotes verbatim and summarising the
 * rest -- is a later pass over this text, not a replacement for it.
 *
 * A clip with no prompt (an upload) contributes an empty entry rather than
 * vanishing, so the count of paragraphs still matches the row.
 */
export function scriptOf(
  clips: Array<Pick<VideoRecord, 'description'>>,
): string {
  return clips.map((clip) => clip.description?.trim() ?? '').join('\n\n')
}

/** One clip's line, as the script tab lists it. */
export interface ScriptLine {
  clipId: string
  /** Position in the run, 1-based -- what the list is numbered by. */
  number: number
  /** What the character says in this clip. */
  line: string
  /** Null when the prompt carried no spoken line to find, which is the honest
   *  answer rather than an empty row: the clip is still in the run. */
  spoken: boolean
}

/**
 * Where a chat clip's prompt stops being setup and starts being speech.
 *
 * `composeClipPrompt` ends every clip prompt with this and the line in quotes,
 * so the marker is a fact about how the prompt was built rather than a guess
 * about its wording. Both spellings: "in English" was added to the front of
 * the prompt and beside the line in #688, and every clip made before that
 * carries the shorter one.
 */
const SPOKEN = /Speaking to camera(?:, in English)?:\s*"([\s\S]*)"\s*$/

/**
 * The dialogue of a chat session, in run order (#690).
 *
 * **Chat sessions only, and that restriction is the whole of why this is safe.**
 * `scriptOf` above carries a warning worth re-reading: its first cut pulled the
 * quoted spans out of each prompt as the spoken lines and was wrong, because a
 * run's prompts are massaged by hand and the music, the action and the setup
 * are in them deliberately. None of that applies here. A chat clip's prompt is
 * assembled in code by `composeClipPrompt` from four known parts -- a fixed
 * sentence, the session's character, the answer's scene, this clip's action,
 * and the line in quotes -- so taking the line back out is reading a structure
 * we wrote, not guessing at one.
 *
 * **It follows the run, not the transcript.** A turn's stored `line` is the
 * whole answer as it was written; the run is what survived, after bursts were
 * removed and re-rolled. Reading the clips is what makes the script say what
 * the film says.
 */
export function dialogueOf(
  clips: Array<Pick<VideoRecord, 'id' | 'description'>>,
): Array<ScriptLine> {
  return clips.map((clip, index) => {
    const match = SPOKEN.exec(clip.description?.trim() ?? '')
    return {
      clipId: clip.id,
      number: index + 1,
      line: match ? match[1].trim() : '',
      spoken: match !== null,
    }
  })
}

/** The dialogue as one block of text, for the copy button. Numbered, because
 *  the numbers are how a line is found again in the row. */
export function dialogueText(lines: Array<ScriptLine>): string {
  return lines
    .map((l) => `${l.number}. ${l.spoken ? l.line : '(no dialogue)'}`)
    .join('\n\n')
}
