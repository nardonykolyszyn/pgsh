const c = require('ansi-colors');

const confirm = require('../util/confirm-prompt');
const waitFor = require('../util/wait-for');

// N.B. yargs didn't work so well when this was [source] <target>,
// so we have to account for the 1-argument version in our handler.
exports.command = 'clone [source] [target]';
exports.desc = 'clones a database, then (potentially) switches to it';

exports.builder = yargs => yargs
  .positional('source', {
    describe: 'the database to clone (defaults to the current database)',
    type: 'string',
  })
  .positional('target', {
    describe: 'the name to give the cloned database (required!)',
    type: 'string',
    required: true,
    default: undefined,
  })
  .option('f', {
    alias: 'force',
    type: 'boolean',
    describe: 'do not warn before overwriting an existing database (use with caution!)',
    default: false,
  })
  .option('s', {
    alias: 'switch',
    type: 'boolean',
    describe: 'switch to the newly-created database (by default true when cloning the current db)',
    default: undefined,
  })
  .option('S', {
    type: 'boolean',
    describe: 'do not switch to the newly-created database',
    default: undefined,
  })
  .conflicts('s', 'S')
  .conflicts('S', 's');

exports.handler = async ({
  source: argSource,
  target: argTarget,
  force,
  s, // -s, --switch
  S, // -S, --no-switch
}) => {
  const db = require('../db')();
  const clone = require('../task/clone')(db);

  // account for the 1-argument version (target only).
  const currentDb = db.thisDb();
  const oneArg = !argTarget;
  const source = oneArg ? currentDb : argSource;
  const target = oneArg ? argSource : argTarget;

  if (source === target) {
    console.log('Cannot clone a database over itself.');
    return process.exit(2);
  }

  const targetExists = await db.isValidDatabase(target);
  if (targetExists) {
    const interruptHandler = () => {
      console.log(`\nDid not drop ${target}!`);
      return process.exit(0);
    };

    console.log(`The ${target} database already exists.`);
    try {
      if (!force) {
        await confirm(c.redBright('Type the database name to drop it: '), target);
      }

      // wait for the database to be unused, then drop it
      await waitFor(db, target, interruptHandler);
      const knex = db.connectAsSuper(db.fallbackUrl());
      await knex.raw(`drop database "${target}"`);
      await new Promise(resolve => knex.destroy(resolve));

      console.log(c.redBright(`Dropped ${target}!`));
    } catch (err) {
      console.error('reason:', err);
      console.log('Not dropping.');
      return process.exit(0);
    }
  }

  /* eslint-disable max-len */
  let shouldSwitch = (source === currentDb);  // by default, only switch if we're cloning the current db
  if (s !== undefined) shouldSwitch = s;      // user has explicitly decided via -s, --switch
  if (S !== undefined) shouldSwitch = !S;     // user has explicitly decided via -S, --no-switch
  /* eslint-enable max-len */

  console.log(`Going to clone ${source} to ${target}...`);
  try {
    await clone(source, target);
    if (shouldSwitch) {
      db.switchTo(target);
      console.log(`Done! Switched to ${target}.`);
    } else if (currentDb === target) {
      console.log(`Done! Cloned over your current database ${target}.`);
    } else {
      console.log(`Done! Created ${target}.`);
    }
    return process.exit(0);
  } catch (err) {
    console.error(
      `Clone failed: ${c.redBright(err.message)}`,
    );
    return process.exit(1);
  }
};
