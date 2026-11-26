1 quick capture must be able choise which milestone the task should be added:
    1.1 when moved to project by arrow keys: for now  it have to click to skip throught project it can be change to a ropdown to select which project
    after that next dropdown must show milestone according to that project

    1.2 Today tab can be changed to check box: so even if it a inbox, project task or misc we can add it to today plan


2 inbox can be changed to idea or flash or to something

3 Task must have optional feature of mentioning a person and taging note
    3.1 we can mention a client with a small pop up window with a search bar or othre people other people must have: name + contact by (text field to filed eaither email or phone number).

    3.2  we can make note & links in every project  task must have this optional feature of taging a one or many notes and links
        3.2.1 This not and links must can be taged to milestone itself too.

# Plan: Quick capture milestones + Add to Today (feature 1)

## Current code
- The popup is `src/routes/quick/+page.svelte`. It has four pills: Inbox, Today, Project task, Misc.
- The project is a clickable chip, also cycled with Up/Down (`projectStep()` in `src/lib/quickadd.svelte.ts`).
- `addTask()` in `src/lib/db.ts` already accepts `milestone_id` and a `plannedFor` day. `addInboxItem()` writes the separate Inbox table.
- No database migration, Rust command, or new dependency is needed.

## Target behavior
- Pills become **Inbox / Project task / Misc**. The Today pill is removed.
- An **Add to Today** checkbox sits beside the pills and works for all three kinds.
- A **Project** dropdown replaces the clickable/cycled chip. It is always shown for Project task, and shown for Inbox when Add to Today is checked. It offers `Misc` plus the active projects.
- A **Milestone** dropdown follows it whenever a real project is selected. Its options come from `getMilestones()` filtered by that `project_id`. Changing the project clears the milestone. Misc shows a disabled `Misc has no milestone` dropdown; a project with no milestones shows a disabled explanation.
- Save rules:
  - **Inbox**: always add the Inbox item. If Add to Today is checked, also add a task with the chosen project/milestone, planned for today.
  - **Project task**: add one task with the chosen project/milestone, planned for today only when checked.
  - **Misc**: add a Misc task, planned for today only when checked.
- Notifications: `notifyInboxChanged()` when an Inbox row was written, `notifyDataChangedEverywhere()` when a task was written, both for Inbox + Today.

## Files to change
1. `src/routes/quick/+page.svelte` — state (`milestoneId`, `planToday`), load milestones, dropdown markup, save logic, footer hints and confirmation text.
2. `src/lib/shortcuts.svelte.ts` — remove Up/Down project cycling from the quick capture shortcut help (it remains valid for the New dialog and widget).
3. `README.md` and `CLAUDE.md` — describe the new pills, dropdowns and checkbox.
4. `.gitignore` — ignore `/docs/md/` so this planning file stays local.

## Verification
- `npm run check` and `npm run build` must pass.
- Manual cases: Inbox alone; Inbox + Today with a project and milestone; Project task with/without milestone; Misc + Today; switching projects clears the old milestone.
