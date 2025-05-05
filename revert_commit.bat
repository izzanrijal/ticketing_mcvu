@echo off
if "%1"=="" (
    echo Error: Please provide the target commit hash or reference (e.g., HEAD~3) as an argument.
    echo Example: revert_commit.bat abc1234
    echo Example: revert_commit.bat HEAD~2
    pause
    exit /b 1
)

set TARGET_COMMIT=%1

echo Fetching latest changes...
git fetch origin

echo Resetting to commit %TARGET_COMMIT%...
REM IMPORTANT: This will discard any local changes made after the target commit!
git reset --hard %TARGET_COMMIT%

echo Running post-pull script...
npm run postpull

echo Revert to %TARGET_COMMIT% complete.
pause
