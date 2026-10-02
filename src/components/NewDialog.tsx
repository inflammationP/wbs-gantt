import { useState } from 'react'
import { Modal, Segmented } from './ui'
import { TaskForm } from './TaskDialog'
import { ProjectForm } from './ProjectDialog'
import { useStore } from '../store/useStore'
import { PROJECT_COLORS } from '../lib/ui'
import { useT } from '../lib/useT'

export type NewKind = 'task' | 'project'

/**
 * One dialog for the two things a board is made of.
 *
 * The toolbar's new button used to open the task dialog, with projects only
 * creatable from Manage — and there by a one-line name prompt, so the board's
 * two nouns were made in two different places by two different means. Here the
 * task is what it opens on, because that is what the button has always meant,
 * and the project is one tab away.
 *
 * Which tab it opens on is not quite "task, always". A board with no projects
 * has nowhere to put a task, and the array the task form picks its project from
 * is empty — so the form that can actually be saved is the one it starts on.
 * That is also the case that used to be handled by refusing the button and
 * showing a paragraph telling the user to go to another page and make a project
 * first, which is a thing you should not have to leave the work to do.
 *
 * The two forms are the same components their own dialogs use, minus the frame:
 * `TaskForm` and `ProjectForm` draw no `Modal` of their own, so this one can
 * hold either without a second copy of the fields.
 */
export function NewDialog({
  onClose,
  kind: asked,
  defaultProjectId,
}: {
  onClose: () => void
  kind?: NewKind
  defaultProjectId?: string
}) {
  const t = useT()
  const projects = useStore((s) => s.projects)
  const addProject = useStore((s) => s.addProject)
  const [kind, setKind] = useState<NewKind>(
    () => asked ?? (projects.length === 0 ? 'project' : 'task'),
  )

  return (
    <Modal title={t('new.title')} onClose={onClose} width={560}>
      <div className="space-y-3">
        {/* The tab strip is the top of the dialog, above the fields rather than
            beside the buttons: it decides which fields there are. */}
        <div className="flex">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'task', label: t('new.task') },
              { value: 'project', label: t('new.project') },
            ]}
          />
        </div>

        {kind === 'task' ? (
          <TaskForm onClose={onClose} defaultProjectId={defaultProjectId} />
        ) : (
          <ProjectForm
            // The next colour in the palette, which is what the Manage page's
            // button chose for a new project too — the form only makes it
            // visible, and changeable, at the moment it is being picked.
            initial={{
              name: '',
              color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
              description: '',
            }}
            submitLabel={t('common.create')}
            onSubmit={(fields) => addProject(fields.name, fields.color, fields.description)}
            onClose={onClose}
          />
        )}
      </div>
    </Modal>
  )
}
