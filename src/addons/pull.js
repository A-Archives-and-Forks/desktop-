const fs = require('fs');
const childProcess = require('child_process');
const rimraf = require('rimraf');
const pathUtil = require('path');

const walk = dir => {
  const children = fs.readdirSync(dir);
  const files = [];
  for (const child of children) {
    const path = pathUtil.join(dir, child);
    const stat = fs.statSync(path);
    if (stat.isDirectory()) {
      const childChildren = walk(path);
      for (const childChild of childChildren) {
        files.push(pathUtil.join(child, childChild));
      }
    } else {
      files.push(child);
    }
  }
  return files;
};

rimraf.sync('ScratchAddons');
rimraf.sync('addons');
rimraf.sync('addons-l10n');
rimraf.sync('libraries');
rimraf.sync('libraries-raw');

childProcess.execSync('git clone --depth=1 -b tw https://github.com/GarboMuffin/ScratchAddons ScratchAddons');

fs.mkdirSync('addons', {recursive: true});
fs.mkdirSync('addons-l10n', {recursive: true});
fs.mkdirSync('libraries', {recursive: true});
fs.mkdirSync('libraries-raw', {recursive: true});

const HEADER = `/**!
 * Imported from SA
 * @license GPLv3.0 (see LICENSE or https://www.gnu.org/licenses/ for more information)
 */\n\n`;

const addons = require('./addons.json');
for (const addon of addons) {
  const oldDirectory = pathUtil.join('ScratchAddons', 'addons', addon);
  const newDirectory = pathUtil.join('addons', addon);
  for (const file of walk(oldDirectory)) {
    const oldPath = pathUtil.join(oldDirectory, file);
    const newPath = pathUtil.join(newDirectory, file);
    fs.mkdirSync(newDirectory, {recursive: true});
    let contents = fs.readFileSync(oldPath, 'utf-8');

    // Add a license notice, unless one already exists.
    if ((file.endsWith('.js') || file.endsWith('.css')) && !contents.includes('@license')) {
      contents = HEADER + contents;
    }

    // They said not to parse HTML with regex, but I was never told anything about parsing JS with regex.
    // This is horrible.
    if (file.endsWith('.js')) {
      {
        // Parse things like:
        // import { normalizeHex, getHexRegex } from "../../libraries/normalize-color.js";
        // import RateLimiter from "../../libraries/rate-limiter.js";
        const matches = [...contents.matchAll(/import +(?:{.*}|.*) +from +["']\.\.\/\.\.\/libraries\/([\w\d_-]+\.js)["'];/g)];
        for (const match of matches) {
          const libraryFile = match[1];
          const oldLibraryPath = pathUtil.join('ScratchAddons', 'libraries', libraryFile);
          const newLibraryPath = pathUtil.join('libraries', libraryFile);
          const libraryContents = fs.readFileSync(oldLibraryPath, 'utf-8');
          fs.writeFileSync(newLibraryPath, libraryContents);
        }
      }

      {
        // Parse things like:
        // await addon.tab.loadScript(addon.self.lib + "/tinycolor-min.js");
        const matches = [...contents.matchAll(/addon\.self\.lib *\+ *["']\/([\w\d_-]+\.js)["']/g)];
        for (const match of matches) {
          const libraryFile = match[1];
          const oldLibraryPath = pathUtil.join('ScratchAddons', 'libraries', libraryFile);
          const newLibraryPath = pathUtil.join('libraries-raw', libraryFile);
          const libraryContents = fs.readFileSync(oldLibraryPath, 'utf-8');
          fs.writeFileSync(newLibraryPath, libraryContents);
        }
      }
    }

    fs.writeFileSync(newPath, contents);
  }
}

const languages = fs.readdirSync(pathUtil.join('ScratchAddons', 'addons-l10n'));
for (const language of languages) {
  const oldDirectory = pathUtil.join('ScratchAddons', 'addons-l10n', language);
  const newDirectory = pathUtil.join('addons-l10n', language);
  if (!fs.statSync(oldDirectory).isDirectory()) {
    continue;
  }
  fs.mkdirSync(newDirectory, {recursive: true});
  for (const addon of addons) {
    const oldFile = pathUtil.join(oldDirectory, `${addon}.json`);
    const newFile = pathUtil.join(newDirectory, `${addon}.json`);
    try {
      const contents = fs.readFileSync(oldFile, 'utf-8');
      // Parse and stringify to minimize
      const parsed = JSON.parse(contents);
      fs.writeFileSync(newFile, JSON.stringify(parsed));
    } catch (e) {
      // Ignore
    }
  }
}
