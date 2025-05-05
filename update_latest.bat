@echo off
echo Fetching latest changes...
git fetch origin

echo Resetting to latest origin/main...
REM IMPORTANT: This assumes your main remote branch is 'main'. Change 'main' if your default branch is different.
REM This will discard any local changes!
git reset --hard origin/main

echo Running post-pull script...
npm run postpull

echo Update complete.
pause
