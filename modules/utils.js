var fs = require('fs');
var _ = require('lodash');

module.exports = {

	/**
	*	Merges the config & platform translation null groups.
	*	@param platformEnUsPath: the platform translation file
	*	@param configEnUsPath: the config translation file
	*	@returns: an object containing a merge of the null groups from both params
	**/
	mergeTranslations: (platformEnUsPath, configEnUsPath) => {
		const platformEnUs = require(platformEnUsPath);
		const configEnUs = require(configEnUsPath);

		const platformTranslations = _.filter(platformEnUs.groups, (group) => {
			return group.groupName === null;
		});

		const configTranslations = _.filter(configEnUs.groups, (group) => {
			return group.groupName === null;
		});

		return _.merge(platformTranslations[0].subgroups[0].translations, configTranslations[0].subgroups[0].translations);
	},

	/**
	*	Reads a form and returns it as an object.
	*	Tries to require form, if it fails, then try to remove items causing error
	*	@param filePath: the path to the file to read
	*	@param filename: the name of the file to read
	*	@returns the form as an object
	**/
	parseForm: (filePath, filename) => {
		let form = null;
		try {
			form = require(filePath);
		} catch (error) {
			let tempForm = fs.readFileSync(filePath, 'utf-8');
			tempForm = tempForm.split('\n');

			tempForm = _.map(tempForm, (line, index, arr) => {
				if (_.startsWith(_.trim(line), 'template:')) {
					line = _.replace(line, 'require(', '');

					if (line.match(/(\)|\),)$/)) {
						line = _.replace(line, ')', '');
					} else {
						let nextIndex = index+1;
						let nextLine = arr[nextIndex];
						while (!nextLine.match(/(\)|\),)$/)) {
							++nextIndex;
							nextLine = arr[nextIndex];
						}

						arr[nextIndex] = _.replace(nextLine, ')', '');
					}

				}
				return line;
			});

			tempForm = _.join(tempForm, '\n');
			fs.writeFileSync(__dirname + `/../temp_files/${filename}`, tempForm);
			form = require(__dirname + `/../temp_files/${filename}`);
		}
		return form;
	},

	/**
	*	Removes raw templates fields from the print options array containing fields
	*	@param data: the print options array, with possible raw templates
	*	@returns: a array containing raw template free fields
	**/
	removeRawTemplates: (data) => {
		_.remove(data, (option) => option.fieldDef.type === 'raw' );
		return data;
	},

	/**
	*	Splits a string of rules into an array of rules
	*	@param rules: the rules to split (e.g. 'caseIsSubmitted && caseIsClosed')
	*	@returns: an array, with the rules split (e.g. ['caseIsSubmitted', 'caseIsClosed'])
	**/
	splitRules: (rules) => {
		if (!rules) return [];

		const splitRegex = /\|\||&&/;
		let result = rules.split(splitRegex);

		return result.reduce((acc, rule) => {
			rule = rule.replace(/[^\w]/g, '');
			acc.push(rule);

			return acc;
		}, []);
	}
};