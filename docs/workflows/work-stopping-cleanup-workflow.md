# Work Stopping Cleanup Workflow

Use this checklist at the end of a StudioPulse development session.

---

## 1. Save and verify repository work

Run this inside every repository used during the session:

```bash
git status
git branch --show-current
```

Current local repositories:

```text
~/Developer/studiopulse/SP-react
~/Developer/studiopulse/SP-express
~/Developer/studiopulse/note-detective
```

Confirm that each repository is in one of these states:

- working tree clean, or
- intentional changes are committed, or
- intentional work-in-progress changes are clearly understood

Do not leave patch files, build artifacts, or accidental generated files untracked.

Useful checks:

```bash
git status --short
git diff --check
git log -3 --oneline
```

---

## 2. Run final validation

Use the commands that apply to the repository.

### SP-react

```bash
npm run lint
npm run build
```

When the full lint command has known unrelated failures, run targeted ESLint on the changed files and record that clearly in the PR.

### SP-express

Run the relevant focused test file or test suite:

```bash
npm test
```

Example:

```bash
npx jest tests/gameProgress.test.js --runInBand
```

### note-detective

```bash
npm run lint
npm run build
```

Optional local visual check:

```bash
npm run dev
```

Default Vite URL:

```text
http://localhost:5173
```

Stop the development server with:

```text
Ctrl+C
```

---

## 3. Commit and push completed work

Review before staging:

```bash
git status --short
git diff --stat
git --no-pager diff
```

Stage only the intended files:

```bash
git add <files>
```

Review staged changes:

```bash
git diff --cached --stat
git --no-pager diff --cached
```

Commit:

```bash
git commit -m "<type>: <clear description>"
```

Push:

```bash
git push
```

For a new branch without an upstream:

```bash
git push -u origin <branch-name>
```

Common commit types:

```text
feat:
fix:
docs:
refactor:
style:
test:
chore:
```

---

## 4. Complete Pull Request cleanup

After a PR is merged:

```bash
git switch main
git pull origin main
git branch -d <merged-branch>
git status
```

Delete the remote branch when GitHub offers the option.

Expected final state:

```text
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

Do not delete a branch that still contains unmerged work.

---

## 5. Update documentation and tracking

Before stopping, update what applies:

- repository development log
- architecture or product documentation
- GitHub issue status
- Trello checklist
- Trello card list or completion status
- PR description and validation results

Documentation ownership:

```text
SP-react/docs
    Frontend architecture, routing, UI/product decisions, frontend logs

SP-express/docs
    Backend APIs, models, authorization, persistence, platform architecture

note-detective/docs
    Game architecture, gameplay decisions, messaging contract, game logs
```

---

## 6. Stop local development processes

Stop frontend or backend development servers in their terminal windows:

```text
Ctrl+C
```

Check common local ports when needed:

```bash
lsof -i :5173
lsof -i :3000
lsof -i :5000
lsof -i :18789
```

No output means nothing is listening on that port.

To stop a known local process manually:

```bash
kill <PID>
```

Use `kill -9` only as a last resort.

---

## 7. Stop the OpenClaw development VM

Important: stop only `openclaw-dev`.

```bash
gcloud compute instances stop openclaw-dev --zone=us-west1-b
```

Do not stop the production VM:

```text
studio-pulse
```

---

## 8. Verify VM status

```bash
gcloud compute instances list
```

Expected:

```text
openclaw-dev  us-west1-b  ...  TERMINATED
studio-pulse  us-west1-c  ...  RUNNING
```

For a focused check:

```bash
gcloud compute instances describe openclaw-dev \
  --zone=us-west1-b \
  --format="get(status)"
```

Expected:

```text
TERMINATED
```

---

## 9. Verify the SSH tunnel is closed

The OpenClaw browser tunnel uses local port `18789`.

Check it:

```bash
lsof -i :18789
```

Expected:

```text
no output
```

If an SSH process is still listening, return to the tunnel terminal and press:

```text
Ctrl+C
```

OpenClaw browser URL:

```text
http://127.0.0.1:18789
```

It should no longer load after the VM and tunnel are stopped.

---

## 10. Final end-of-session check

Run:

```bash
gcloud compute instances list
```

Confirm:

```text
openclaw-dev = TERMINATED
studio-pulse = RUNNING
```

Then confirm each active repository:

```bash
git status
```

Final checklist:

- [ ] Work committed or intentionally preserved
- [ ] Changes pushed
- [ ] PR created or merged when appropriate
- [ ] Development log updated
- [ ] Trello/GitHub tracking updated
- [ ] Local development servers stopped
- [ ] SSH tunnel closed
- [ ] `openclaw-dev` terminated
- [ ] `studio-pulse` still running
- [ ] Repository state understood before closing terminals

---

## Useful links

```text
StudioPulse production:
https://studiopulse.co

OpenClaw local tunnel:
http://127.0.0.1:18789

Note Detective local Vite app:
http://localhost:5173
```

GitHub repositories:

```text
https://github.com/FaridaNelson/SP-react
https://github.com/FaridaNelson/SP-express
https://github.com/FaridaNelson/note-detective
```
