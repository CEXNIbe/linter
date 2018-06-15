var _ = require('lodash');
var colors = require('colors');
var noErrorFound = true;

module.exports = {
	printFields: (fileName, message, options) => {
		if (_.isEmpty(options)) return;

		errorFound();
		console.log(`\n${message} in ${colors.green(fileName)}`);
		_.forEach(options, (option) => {
			if (!option.color) option.color = 'red';

			printField(option);
		});
	},

	printPicklists: (fileName, picklists, message) => {
		if (_.isEmpty(picklists)) return;

		errorFound();
		console.log('\n' + message + ' in ' + colors.green(fileName));
		_.forEach(picklists, (picklist) => {
			printPicklistItem(picklist);
		});
	},

	printArrayList: (fileName, arrayList, message) => {
		if (_.isEmpty(arrayList)) return;

		errorFound();
		console.log('\n' + message + ' in ' + colors.green(fileName));
		_.forEach(arrayList, (item) => {
			console.log(colors.red(item));
		});
	},

	printErrorsFound: () => {
		if (noErrorFound) {
			console.log(colors.green('No Errors Found'));
		}
	}
}

function printPicklistItem (result) {
	var item = result.value;
	var keys = _.keys(item);
	var output = `{\n`;
	_.forEach(keys, function(key) {
		var printKey = key;
		var printValue = item[key];
		if (key === result.offending.key && result.offending.keyOffending) {
			printKey = colors.red(key);
		}

		if (key === result.offending.key && result.offending.valueOffending) {
			printValue = colors.red(item[key]);
		}

		if (typeof item[key] === 'string') {
			output += `\t${printKey}: '${printValue}'\n`;
		} else if (typeof item[key] === 'object') {
			output += `\t${printKey}: [\n`;
			item[key].forEach(function(parent) {
				var printParent = parent;
				if (_.trim(parent) !== parent) {
					printParent = colors.red(parent);
				}
				output += `\t\t'${printParent}'\n`;
			})
			output +=  `\t]\n`
		} else {
			output += `\t${printKey}: ${item[key]}\n`;
		}
	});
	output += `}`;
	console.log(output);
}

function printField(option) {
	var result = '{\n';
	_.forEach(option.attributes, (key) => {
		result += `\t${key}: ${colors[option.color](_.get(option.fieldDef, key))}\n`;
	});
	result += `}\n`;
	console.log(result);
}

function errorFound () {
	noErrorFound = false;
}