const c = require('ansi-colors');
const Bluebird = require('bluebird');
const { prompt } = require('enquirer');

const varChoices = vars => Object.keys(vars)
  .map(key => ({
    hint: c.dim(`(${vars[key]})`),
    value: key,
  }));

/**
* Iteratively ask for a number of keys (in order),
* removing from the potential set every time one is selected.
*
* @param {*} vars key/value pairs, e.g. extracted from a .env file
* @param {*} prompts the things we want to assign, e.g
*                    [{ name: 'url', description: 'connection URL' }, ...]
* @returns a mapping from prompt names to the variable key they've chosen
*/
const promptForVars = async (vars, prompts) => {
  const mapping = {};
  let choices = varChoices(vars);
  await Bluebird.mapSeries(
    prompts,
    async ({ name, description }) => {
      const { selected } = await prompt({
        type: 'select',
        name: 'selected',
        message: `Which variable contains the ${description}?`,
        choices,
      });
      mapping[name] = selected;
      choices = choices.filter(x => x.value !== selected);
    },
  );
  return mapping;
};

module.exports = promptForVars;
