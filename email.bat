@echo off
cd /d %~dp0
start http://localhost:3005
node server.js