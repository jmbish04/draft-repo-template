# make sure origin is correct (don't re-add it)
git remote -v
git remote set-url origin https://github.com/jmbish04/draft-repo-template.git

# confirm you have 0 commits (this will likely fail right now)
git log --oneline --max-count=5

# create your first commit
git add -A
git commit -m "Initial commit"

# now push
git push -u origin main

