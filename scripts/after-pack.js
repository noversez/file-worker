const fs = require('node:fs/promises');
const path = require('node:path');

exports.default = async function afterPack(context) {
  const localesDir = path.join(context.appOutDir, 'locales');
  const keep = new Set(['en-US.pak', 'ru.pak']);

  try {
    const entries = await fs.readdir(localesDir, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      if (entry.isFile() && entry.name.endsWith('.pak') && !keep.has(entry.name)) {
        await fs.rm(path.join(localesDir, entry.name), { force: true });
      }
    }));
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }
  }
};
