@echo off
rem Pubblica la versione web di Accadde Oggi su Cloudflare Pages (gratis).
rem Doppio clic: costruisce il sito e lo carica. Made in Italy.
setlocal
cd /d "%~dp0frontend"
echo.
echo  Preparo la versione web di Accadde Oggi...
echo.
call yarn install --frozen-lockfile || goto :errore
set EXPO_PUBLIC_BACKEND_URL=https://accadde-oggi-api.onrender.com
set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=727081593792-pbs5ve4p4l7cr4ck60f3dsd8263afs16.apps.googleusercontent.com
call npx expo export -p web || goto :errore
echo.
echo  Carico su Cloudflare Pages...
set CLOUDFLARE_ACCOUNT_ID=9e3760c31a0b323e4ce9cd79481e2348
call npx -y wrangler@3 pages deploy dist --project-name accadde-oggi --branch main --commit-dirty=true || goto :errore
echo.
echo  Fatto: https://accadde-oggi.pages.dev
rmdir /s /q node_modules 2>nul
rmdir /s /q dist 2>nul
pause
exit /b 0
:errore
echo.
echo  Qualcosa e' andato storto: guarda il messaggio qui sopra.
pause
exit /b 1
