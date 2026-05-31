/**
 * Deterministic tag colours — a tag's hue is derived from its name (no DB
 * column needed), so the same tag is the same colour everywhere: note chips,
 * graph nodes, and cluster hulls all agree.
 */
const TAG_HUES = [255, 28, 150, 330, 285, 200, 95, 350, 225, 120, 60, 310]

export function tagHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return TAG_HUES[h % TAG_HUES.length]
}

/** OKLCH colour string for a tag (used on the graph canvas). */
export function tagColor(name: string, l = 0.62, c = 0.12, a = 1): string {
  return `oklch(${l} ${c} ${tagHue(name)} / ${a})`
}

/** Chip styles for the note editor — theme-aware, translucent tint + solid ink. */
export function tagChipStyle(name: string, isDark: boolean) {
  const hue = tagHue(name)
  return {
    background: `oklch(${isDark ? 0.5 : 0.62} 0.12 ${hue} / ${isDark ? 0.22 : 0.14})`,
    color: `oklch(${isDark ? 0.82 : 0.42} 0.13 ${hue} / 1)`,
    borderColor: `oklch(${isDark ? 0.6 : 0.55} 0.12 ${hue} / 0.4)`,
  }
}
