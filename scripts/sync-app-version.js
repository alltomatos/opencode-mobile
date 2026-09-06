#!/usr/bin/env node
// Roda automaticamente via `npm version <patch|minor|major>` (hook "version"
// do package.json) — não é pra ser chamado direto no dia a dia. `npm version`
// já cuida do semver do package.json; aqui só espelhamos esse número pro
// app.json (expo.version, o que aparece pro usuário) e incrementamos os
// números de build nativos (versionCode/buildNumber), que o Android e a
// App Store exigem como inteiro sempre crescente — semver sozinho não
// serve pra isso, dois releases "0.1.1" precisam de builds nativas
// diferentes se algum já foi enviado pra loja.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const packageJsonPath = path.join(root, 'package.json');
const appJsonPath = path.join(root, 'app.json');

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const app = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

app.expo.version = pkg.version;

app.expo.android ??= {};
app.expo.android.versionCode = (app.expo.android.versionCode ?? 0) + 1;

app.expo.ios ??= {};
app.expo.ios.buildNumber = String((Number.parseInt(app.expo.ios.buildNumber ?? '0', 10) || 0) + 1);

fs.writeFileSync(appJsonPath, `${JSON.stringify(app, null, 2)}\n`);

console.log(
  `app.json sincronizado: version=${app.expo.version} · android.versionCode=${app.expo.android.versionCode} · ios.buildNumber=${app.expo.ios.buildNumber}`,
);
