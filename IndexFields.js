var _ = require('lodash');
var caseIndex = require(process.argv[2] + '/entities/case/index.js');
var caseIndexFieldNames = getIndexFields(caseIndex.fields);
var caseCaptureForm = require(process.argv[2] + '/config/form-layouts/case-capture-form.js');
var caseOverviewForm = require(process.argv[2] + '/config/form-layouts/case-overview-form.js');
var caseResolutionForm = require(process.argv[2] + '/config/form-layouts/case-resolution-form.js');
var caseRules = require(process.argv[2] + '/entities/case/rules.js');
var colors = require('colors');

var partyIndex = require(process.argv[2] + '/entities/party/index.js');
var partyIndexFieldNames = getIndexFields(partyIndex.fields);
var partyDetailsForm = require(process.argv[2] + '/config/form-layouts/party-details-form.js');
var partyRules = require(process.argv[2] + '/entities/party/rules.js');

checkFieldsInIndex(caseIndexFieldNames, caseCaptureForm, 'case-capture-form.js');
checkFieldsInIndex(caseIndexFieldNames, caseOverviewForm, 'case-overview-form.js');
checkFieldsInIndex(caseIndexFieldNames, caseResolutionForm, 'case-resolution-form.js');
checkFieldsInIndex(partyIndexFieldNames, partyDetailsForm, 'party-details-form.js');

checkFieldTypes(caseIndex.fields, 'case/index.js');
checkFieldTypes(partyIndex.fields, 'party/index.js');

checkDisplayRulesExist(caseOverviewForm.elements, caseRules, 'case-overview-form.js');
checkDisplayRulesExist(partyDetailsForm.elements, partyRules, 'party-details-form.js');




// Functions

function checkFieldsInIndex(indexFieldNames, form, fileName) {
	var missingFields = form.elements
		.reduce(function (acc, field) {
			if (field.type == 'section') {
				var sectionFields = checkFieldsInIndex(indexFieldNames, field);
				if (sectionFields.lenght > 0) {
					sectionFields.forEach(function(sectionField) {
						acc.push(sectionField);
					});
				}
			} else if (!_.includes(indexFieldNames, field.field)) {
				acc.push(field)
			}
			return acc;
		}, []);

	printFields(fileName, missingFields, null, 'Missing from Index file');
	return missingFields;
}

function checkFieldTypes(index, indexName) {
	var fieldTypes = require(process.argv[3]);
	var shadyFieldTypes = index.filter(function(fieldDef) {
		return !_.find(fieldTypes, ['name', fieldDef.type]);
	});

	printFields(indexName, shadyFieldTypes, 'type', 'Shady field types');
}

function checkDisplayRulesExist(fieldDefs, rules, fileName) {
	rules = Object.keys(rules);
	var undefinedDR = fieldDefs.reduce(function(acc, fieldDef) {
		if (!fieldDef.displayRule) {
			return acc;
		}

		var splitRegex =  /\|\||&&/;
		var displayRules = fieldDef.displayRule.split(splitRegex);
		displayRules.forEach(function(displayRule) {
			displayRule = _.trim(displayRule);
			if (!_.includes(rules, displayRule)) {
				acc.push(displayRule);
			}
		});

		return acc;
	}, []);

	if (_.size(undefinedDR) > 0) {
		console.log('\nUndefined display rules in ' + colors.green(fileName))
		undefinedDR = _.uniq(undefinedDR);
		undefinedDR.forEach(function(dr) {
			console.log(colors.red(dr));
		})
	}
}

function printFields(file, fieldDefs, fieldInQuestion, message) {
	if (_.size(fieldDefs) <= 0) {
		return;
	}

	console.log('\n' + message + ' in ' + colors.green(file));
	fieldDefs.forEach((fieldDef) => {
		console.log('{');
		if (fieldInQuestion) {
			console.log('\tfield: ' + fieldDef.field);
			console.log('\t' + fieldInQuestion + ': ' + colors.red(fieldDef[fieldInQuestion]));
		} else {
			console.log('\tfield: ' + colors.red(fieldDef.field));
		}
		console.log('}');
	})
}

function getIndexFields(index) {
	return _.map(index, function(f) {
		return f.field;
	})
}