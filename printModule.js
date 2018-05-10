var _ = require('lodash');
var colors = require('colors');
var noErrorFound = true;

module.exports = {
	printFields: function (file, fieldDefs, message, fieldInQuestion, fieldSecondLevel) {
		if (_.size(fieldDefs) <= 0) {
			return;
		}

		noErrorFound = false;
		console.log('\n' + message + ' in ' + colors.green(file));
		fieldDefs.forEach((fieldDef) => {
			console.log('{');
			if (fieldInQuestion) {
				console.log('\tfield: ' + fieldDef.field);
				if (fieldSecondLevel) {
					console.log('\t' + fieldSecondLevel + ': ' + colors.red(fieldDef[fieldInQuestion][fieldSecondLevel]));
				} else {
					console.log('\t' + fieldInQuestion + ': ' + colors.red(fieldDef[fieldInQuestion]));
				}
			} else {
				console.log('\tfield: ' + colors.red(fieldDef.field));
			}
			console.log('}');
		})
	},

	printPicklists: function (fileName, picklists, message) {
		if (_.size(picklists) <= 0) {
			return;
		}

		noErrorFound = false;
		console.log('\n' + message + ' in ' + colors.green(fileName));
		_.forEach(picklists, function (picklist){
			printPicklistItem(picklist);
		});
	},

	printArrayList: function (fileName, arrayList, message) {
		if (_.size(arrayList) <= 0) {
			return;
		}

		noErrorFound = false;
		console.log('\n' + message + ' in ' + colors.green(fileName));
		_.forEach(arrayList, function (item) {
			console.log(colors.red(item));
		});
	},

	printErrorsFound: function () {
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