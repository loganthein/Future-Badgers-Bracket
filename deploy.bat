@echo off
git add .
git commit -m "Update - %date% %time%"
git push
echo Done! Changes pushed to GitHub.
pause
