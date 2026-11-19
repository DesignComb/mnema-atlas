import { describe, expect, it } from 'vitest'
import { canPassThrough, fitWithin, guessImageType } from './image-prepare'

describe('fitWithin', () => {
  it('scales the long edge down to the max, keeping aspect', () => {
    expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 })
    expect(fitWithin(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 })
  })
  it('never upscales', () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 })
  })
})

describe('guessImageType', () => {
  it('uses the MIME type when present', () => {
    expect(guessImageType({ type: 'image/JPEG', name: 'a.png' })).toBe('image/jpeg')
  })
  it('falls back to the extension when the picker leaves type empty', () => {
    expect(guessImageType({ type: '', name: 'IMG_0001.HEIC' })).toBe('image/heic')
    expect(guessImageType({ type: '', name: 'photo.jpg' })).toBe('image/jpeg')
    expect(guessImageType({ type: '', name: 'noext' })).toBe('')
  })
})

describe('canPassThrough', () => {
  const MB = 1024 * 1024
  it('passes small web images and any GIF', () => {
    expect(canPassThrough('image/jpeg', 0.5 * MB)).toBe(true)
    expect(canPassThrough('image/gif', 4 * MB)).toBe(true)
  })
  it('re-encodes big photos, HEIC, and unknown types', () => {
    expect(canPassThrough('image/jpeg', 6 * MB)).toBe(false)
    expect(canPassThrough('image/heic', 0.5 * MB)).toBe(false)
    expect(canPassThrough('', 0.5 * MB)).toBe(false)
  })
})
