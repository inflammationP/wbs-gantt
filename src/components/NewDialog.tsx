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
  // The click that cannot be honoured, held until the window explaining why is
  // dismissed. See the tab strip below.
  const [noProject, setNoProject] = useState(false)

  return (
    <>
    <Modal title={t('new.title')} onClose={onClose} width={560}>
      <div className="space-y-3">
        {/* The tab strip is the top of the dialog, above the fields rather than
            beside the buttons: it decides which fields there are.
            A board with no projects opens on the project tab — the form that can
            actually be saved — but the task tab stays where it is and stays
            clickable, because the answer to "why not" is a paragraph worth
            reading rather than a control worth disabling: greying it out states
            that something is wrong without saying what, and the person who
            clicks it is exactly the one who needs to be told what a project is
            for. So the click is taken and the window that says so comes up, with
            the tab left where it was — behind it there is still nothing to put a
            task in. */}
        <div className="flex">
          <Segmented
            value={kind}
            onChange={(k) => {
              if (k === 'task' && projects.length === 0) {
                setNoProject(true)
                return
              }
              setKind(k)
            }}
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
    {/* Rendered after the frame, so its portal lands on top of this dialog's:
        the explanation is about the tab that was just pressed, and the form
        behind it stays where it was rather than being replaced. */}
    {noProject && <NoProjectDialog onClose={() => setNoProject(false)} />}
    </>
  )
}

/**
 * What a board with no projects says instead of the task form.
 *
 * A dialog rather than a one-line notice, because this is the first thing a new
 * board can be asked and the answer is structural rather than administrative: a
 * task has to live in a project, and a project is the root of the tree. So the
 * prompt is followed by the two paragraphs that say what that means.
 *
 * It stands in for the form rather than warning beside it — hence the button
 * only acknowledging, with nothing to save.
 *
 * Here rather than with the page that first raised it, because both its callers
 * are about the same thing: the board's new button, which offers the task tab on
 * a board with no projects, and the row menus' "add subtask", which asks for a
 * task where there is no board to hold one. The window belongs to the question
 * "which project does this go in", and that question is this file's.
 */
export function NoProjectDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  return (
    <Modal title={t('common.noticeTitle')} onClose={onClose} width={520}>
      <div className="space-y-3 text-[12px] leading-relaxed text-muted">
        <p className="text-fg">{t('gantt.noProject')}</p>
        <p>{t('gantt.noProject.p1')}</p>
        <p>{t('gantt.noProject.p2')}</p>
      </div>
      <div className="flex justify-end pt-4">
        <button
          onClick={onClose}
          autoFocus
          className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent rounded-[3px]"
        >
          {t('common.gotIt')}
        </button>
      </div>
    </Modal>
  )
}
