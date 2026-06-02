import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCreateTaskList, useUpdateTaskList } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { TaskListRow } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function ListDialog({
  open,
  onOpenChange,
  list,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  list?: TaskListRow
}) {
  const t = useT()
  const editing = Boolean(list)
  const createList = useCreateTaskList()
  const updateList = useUpdateTaskList()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')

  useEffect(() => {
    if (!open) return
    setName(list?.name ?? '')
    setIcon(list?.icon ?? '')
  }, [open, list])

  const pending = createList.isPending || updateList.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      if (editing && list) {
        await updateList.mutateAsync({ list_id: list.id, name: name.trim(), icon: icon.trim() || undefined })
      } else {
        await createList.mutateAsync({ name: name.trim(), icon: icon.trim() || undefined })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save list', '儲存清單失敗'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? t('Rename list', '重新命名清單') : t('New list', '新增清單')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <div className="flex w-16 flex-col gap-1.5">
              <Label htmlFor="list-icon">{t('Icon', '圖示')}</Label>
              <Input
                id="list-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 2))}
                placeholder="📋"
                className="text-center"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="list-name">{t('Name', '名稱')}</Label>
              <Input
                id="list-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('e.g. Work, Groceries', '例如:工作、採買')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={pending || !name.trim()}>
              {pending ? t('Saving…', '儲存中…') : editing ? t('Save', '儲存') : t('Create', '建立')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
