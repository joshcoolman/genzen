import { describe, expect, it } from 'vitest'
import { parseYouTubeId } from './youtube'

/**
 * The id is the only thing that crosses to the server, and the browser builds
 * its embed from the same call -- so a link the two read differently would put
 * one video on screen and cut the frame out of another.
 */
describe('reading a pasted YouTube link', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['  https://youtu.be/dQw4w9WgXcQ  ', 'dQw4w9WgXcQ'],
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('reads %s', (input, expected) => {
    expect(parseYouTubeId(input)).toBe(expected)
  })

  it('keeps the video out of a link that also names a playlist', () => {
    expect(
      parseYouTubeId(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=2&t=42s',
      ),
    ).toBe('dQw4w9WgXcQ')
  })

  it.each([
    ['https://vimeo.com/12345', 'another site'],
    ['https://www.youtube.com/playlist?list=PL123', 'a playlist with no video'],
    ['https://www.youtube.com/watch?v=short', 'an id of the wrong length'],
    ['', 'nothing at all'],
    ['not a url', 'a sentence'],
  ])('refuses %s (%s)', (input) => {
    expect(parseYouTubeId(input)).toBeNull()
  })

  /* An id is eleven characters of a known alphabet, which is what makes it safe
     to put on yt-dlp's argument list without escaping. A parser that let a
     flag through would be handing a subprocess its own options. */
  it('refuses anything that could read as an option', () => {
    expect(parseYouTubeId('--exec=rm')).toBeNull()
    expect(
      parseYouTubeId('https://www.youtube.com/watch?v=--exec=rm'),
    ).toBeNull()
  })
})
