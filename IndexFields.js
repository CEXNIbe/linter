var _ = require('lodash');
var fs = require('fs');
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

var optionsPicklist = require(process.argv[2] + '/config/options.picklists.js');
var enus = require(process.argv[2] + '/data/translations/en_US.js');
var JSONfiles = getJSONFiles();


checkFieldsInIndex(caseIndexFieldNames, caseCaptureForm, 'case-capture-form.js');
checkFieldsInIndex(caseIndexFieldNames, caseOverviewForm, 'case-overview-form.js');
checkFieldsInIndex(caseIndexFieldNames, caseResolutionForm, 'case-resolution-form.js');
checkFieldsInIndex(partyIndexFieldNames, partyDetailsForm, 'party-details-form.js');

checkFieldTypes(caseIndex.fields, 'case/index.js');
checkFieldTypes(partyIndex.fields, 'party/index.js');

checkDisplayRulesExist(caseCaptureForm.elements, caseRules, 'case-capture-form.js');
checkDisplayRulesExist(caseOverviewForm.elements, caseRules, 'case-overview-form.js');
checkDisplayRulesExist(partyDetailsForm.elements, partyRules, 'party-details-form.js');

var casePicklistDefs =  getPicklistDefs(caseIndex.fields);
picklistsDefined(casePicklistDefs, 'case/index.js');
picklistsInOptions(casePicklistDefs, 'case/index.js');
picklistInEn(casePicklistDefs, 'case/index.js');
picklistJSONFileExists(casePicklistDefs, 'case/index.js')

var partyPicklistDefs =  getPicklistDefs(partyIndex.fields);
picklistsDefined(partyPicklistDefs, 'party/index.js');
picklistsInOptions(partyPicklistDefs, 'party/index.js');
picklistInEn(partyPicklistDefs, 'party/index.js');
picklistJSONFileExists(partyPicklistDefs, 'party/index.js');

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

	printFields(fileName, missingFields, 'Missing from Index file', null);
	return missingFields;
}


function checkFieldTypes(index, indexName) {
	var fieldTypes = require(process.argv[3]);
	var shadyFieldTypes = index.filter(function(fieldDef) {
		return !_.find(fieldTypes, ['name', fieldDef.type]);
	});

	printFields(indexName, shadyFieldTypes, 'Shady field types', 'type');
}

function checkDisplayRulesExist(formDef, rules, fileName) {
	rules = Object.keys(rules);
	var undefinedDR = getUnusedDisplayRules(formDef, rules);

	if (_.size(undefinedDR) > 0) {
		console.log('\nUndefined display rules in ' + colors.green(fileName))
		undefinedDR = _.uniq(undefinedDR);
		undefinedDR.forEach(function(dr) {
			console.log(colors.red(dr));
		})
	}
}

function getUnusedDisplayRules(formDef, rules) {
	return formDef.reduce(function(acc, field) {
		if (field.elements) {
			var nested = getUnusedDisplayRules(field.elements);
			acc.push.apply(acc, nested);
		}

		if (field.displayRule) {
			var splitRegex =  /\|\||&&/;
			var displayRules = field.displayRule.split(splitRegex);
			displayRules.forEach(function(displayRule) {
				displayRule = _.trim(displayRule);
				if (!_.includes(rules, displayRule)) {
					acc.push(displayRule);
				}
			});
		}

		return acc;
	}, []);
}

function getPicklistDefs(index) {
	return index.filter(function (fieldDef) {
		return fieldDef.type === 'picklist' || fieldDef.type === 'picklist[]';
	})
}

function picklistsDefined(picklistIndex, fileName) {
	var missingPicklistName = picklistIndex.filter(function(fieldDef) {
		return !_.has(fieldDef, 'typeOptions.picklistName')
	})
	printFields(fileName, missingPicklistName, 'Picklist missing picklistName', 'typeOptions', 'picklistName');
}

function picklistsInOptions(picklistIndex, fileName) {
	var optionsKeys = Object.keys(optionsPicklist);
	var notInOptions = picklistIndex.filter(function (fieldDef) {
		return !_.includes(optionsKeys, fieldDef.typeOptions.picklistName);
	});
	printFields(fileName, notInOptions, 'Picklist missing options.picklist', 'typeOptions', 'picklistName');
}

function picklistJSONFileExists(picklistIndex, fileName) {
	var notInFiles = picklistIndex.filter(function (fieldDef) {
		return !_.includes(JSONfiles, fieldDef.typeOptions.picklistName + ".json");
	});
	printFields(fileName, notInFiles, 'Picklist .json file missing from data/lists', 'typeOptions', 'picklistName');
}

function picklistInEn(index, fileName) {
	var enusKeys = Object.keys(enus.groups[0].subgroups[0].translations);
	var notInEnus = index.filter(function(fieldDef) {
		return !_.includes(enusKeys, fieldDef.typeOptions.picklistName);
	});
	printFields(fileName, notInEnus, 'Picklist translations missing form en_US', 'typeOptions', 'picklistName');
}

function printFields(file, fieldDefs, message, fieldInQuestion, fieldSecondLevel) {
	if (_.size(fieldDefs) <= 0) {
		return;
	}

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
}

function getIndexFields(index) {
	return _.map(index, function(f) {
		return f.field;
	})
}

function getJSONFiles() {
	return fs.readdirSync(process.argv[2] + '/data/lists');
}