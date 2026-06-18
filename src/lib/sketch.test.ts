import { describe, it, expect } from 'vitest'
import { firstImageUrl, parseScene, isBlankScene, emptyScene, type SketchScene } from '@/lib/sketch'

describe('firstImageUrl', () => {
  it('extracts a plain image url', () => {
    expect(firstImageUrl('![](https://x.test/a.webp)')).toBe('https://x.test/a.webp')
  })
  it('ignores alt text', () => {
    expect(firstImageUrl('![my drawing](https://x.test/a.png)')).toBe('https://x.test/a.png')
  })
  it('strips a title', () => {
    expect(firstImageUrl('![](https://x.test/a.png "a title")')).toBe('https://x.test/a.png')
  })
  it('handles angle-bracket urls with spaces', () => {
    expect(firstImageUrl('![](<https://x.test/a b.png>)')).toBe('https://x.test/a b.png')
  })
  it('takes the FIRST image when several exist', () => {
    expect(firstImageUrl('text ![](https://x.test/1.png) more ![](https://x.test/2.png)')).toBe(
      'https://x.test/1.png',
    )
  })
  it('returns null when there is only prose', () => {
    expect(firstImageUrl('just words, and a [link](https://x.test)')).toBeNull()
  })
  it('returns null for empty / nullish bodies', () => {
    expect(firstImageUrl('')).toBeNull()
    expect(firstImageUrl(null)).toBeNull()
    expect(firstImageUrl(undefined)).toBeNull()
  })
  it('does not match a non-image link', () => {
    expect(firstImageUrl('[click](https://x.test/a.png)')).toBeNull()
  })
})

describe('emptyScene / isBlankScene', () => {
  it('an empty scene is blank', () => {
    const s = emptyScene('white', 800, 600)
    expect(isBlankScene(s)).toBe(true)
    expect(s).toMatchObject({ v: 1, bg: 'white', w: 800, h: 600, strokes: [] })
  })
  it('a scene with a stroke is not blank', () => {
    const s = emptyScene('black', 10, 10)
    s.strokes.push({ t: 'pen', c: '#fff', s: 4, p: [[1, 1, 0.5]] })
    expect(isBlankScene(s)).toBe(false)
  })
  it('treats null / undefined as blank', () => {
    expect(isBlankScene(null)).toBe(true)
    expect(isBlankScene(undefined)).toBe(true)
  })
  it('clamps degenerate sizes to at least 1', () => {
    expect(emptyScene('white', 0, -5)).toMatchObject({ w: 1, h: 1 })
  })
})

describe('parseScene', () => {
  it('round-trips a real scene', () => {
    const scene: SketchScene = {
      v: 1,
      bg: 'black',
      w: 400,
      h: 300,
      strokes: [
        { t: 'pen', c: '#ef4444', s: 6, p: [[1, 2, 0.5], [3, 4, 0.6]] },
        { t: 'eraser', c: '#000', s: 20, p: [[5, 6, 1]] },
      ],
    }
    const parsed = parseScene(JSON.parse(JSON.stringify(scene)))
    expect(parsed).toEqual(scene)
  })
  it('rejects non-objects and bad backgrounds', () => {
    expect(parseScene(null)).toBeNull()
    expect(parseScene('nope')).toBeNull()
    expect(parseScene({ bg: 'pink', strokes: [] })).toBeNull()
    expect(parseScene({ bg: 'white' })).toBeNull()
  })
  it('drops malformed strokes but keeps good ones', () => {
    const parsed = parseScene({
      bg: 'white',
      w: 100,
      h: 100,
      strokes: [
        { t: 'pen', c: '#000', s: 4, p: [[0, 0, 0.5]] },
        { t: 'scribble', p: [] }, // bad tool
        { t: 'eraser', p: 'oops' }, // bad points
      ],
    })
    expect(parsed?.strokes).toHaveLength(1)
    expect(parsed?.strokes[0].t).toBe('pen')
  })
})
