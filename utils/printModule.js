/**
	This module handles the console logging
**/


let _ = require('lodash');
let colors = require('colors/safe');
colors.setTheme({
	silly: 'rainbow',
	input: 'grey',
	verbose: 'cyan',
	prompt: 'grey',
	info: 'green',
	data: 'grey',
	help: 'cyan',
	warn: 'yellow',
	debug: 'blue',
	error: 'red'
});

let noErrorFound = true;

module.exports = {
	printFields: (fileName, message, options) => {
		if (_.isEmpty(options)) return;

		errorFound();
		console.log(`\n${message} in ${colors.info(fileName)}`);
		_.forEach(options, (option) => {
			if (!option.color) option.color = 'red';
			if (option.color === 'default') option.color = undefined;

			printField(option);
		});
	},

	printArrayList: (fileName, arrayList, message) => {
		if (_.isEmpty(arrayList)) return;

		errorFound();
		console.log('\n' + message + ' in ' + colors.info(fileName));
		_.forEach(arrayList, (item) => {
			console.log(colors.error(item));
		});
	},

	printErrorsFound: () => {
		if (noErrorFound) {
			console.log(colors.info('No Errors Found'));
		}
	}
}

function printField(option) {
	let result = '{\n';
	_.forEach(option.attributes, (key) => {
		const index = !!option.keyColor ? colors[option.keyColor](key) : key;
		const value = !!option.color ? colors[option.color](_.get(option.fieldDef, key)) : _.get(option.fieldDef, key);

		result += `\t${index}: ${value}\n`;
	});
	result += `}\n`;
	console.log(result);
}

function errorFound () {
	noErrorFound = false;
}