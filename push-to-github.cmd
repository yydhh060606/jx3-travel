@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================
echo  江湖行纪 - 推送到 GitHub
echo ============================================
echo.

echo [1/3] 检查远程仓库 ...
git ls-remote origin >nul 2>&1
if errorlevel 1 (
  echo     未找到远程仓库或尚未登录，先绑定地址 ...
  git remote remove origin >nul 2>&1
  git remote add origin https://github.com/yydhh060606/jx3-travel.git
  git ls-remote origin >nul 2>&1
  if errorlevel 1 (
    echo.
    echo ！ 读不到仓库。请先在 GitHub 上新建一个 **空仓库**：
    echo    https://github.com/new
    echo    仓库名填 jx3-travel，不要勾选 README / .gitignore / license
    echo    建好后重新双击本脚本。
    echo.
    pause
    exit /b 1
  )
)

echo [2/3] 推送 main 分支（首次会弹出 GitHub 登录窗口）...
git push -u origin main
if errorlevel 1 (
  echo.
  echo     推送被拒，可能远程仓库里已有提交，尝试合并后重推 ...
  git pull --rebase origin main
  git push -u origin main
  if errorlevel 1 (
    echo.
    echo ！ 推送失败。请把上面的报错发给助手。
    pause
    exit /b 1
  )
)

echo.
echo [3/3] 完成。接下来在浏览器里开启 Pages：
echo     1. 打开 https://github.com/yydhh060606/jx3-travel/settings/pages
echo     2. Source 选 "Deploy from a branch"
echo     3. Branch 选 main，目录选 / (root)，点 Save
echo     4. 等 1-2 分钟，访问 https://yydhh060606.github.io/jx3-travel/
echo.
pause
