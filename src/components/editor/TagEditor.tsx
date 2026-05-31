import { useNotes, useSetNoteTags } from '@/lib/hooks'
import { TagInput } from './TagInput'

/** Note tags — colour & cluster the note in the graph. Saves immediately. */
export function TagEditor({ noteId, tags }: { noteId: string; tags: string[] }) {
  const setTags = useSetNoteTags()
  const { data: notes } = useNotes()
  const all = Array.from(new Set((notes ?? []).flatMap((n) => n.tags ?? []))).sort()

  return (
    <TagInput
      tags={tags}
      suggestions={all}
      listId="mnema-note-tags"
      onChange={(next) => setTags.mutate({ noteId, tags: next })}
    />
  )
}
