var _ = require('lodash');
var fs = require('fs');
var caseIndex = require(process.argv[2] + '/entities/case/index.js');
var caseIndexFieldNames = getIndexFields(caseIndex.fields);
var caseCaptureForm = parseForm(process.argv[2] + '/config/form-layouts/case-capture-form.js', 'caseCaptureForm.js');
var caseOverviewForm = parseForm(process.argv[2] + '/config/form-layouts/case-overview-form.js', 'caseOverviewForm.js');
var caseResolutionForm = parseForm(process.argv[2] + '/config/form-layouts/case-resolution-form.js', 'caseResolutionForm.js');
var caseRules = require(process.argv[2] + '/entities/case/rules.js');
var colors = require('colors');

var partyIndex = require(process.argv[2] + '/entities/party/index.js');
var partyIndexFieldNames = getIndexFields(partyIndex.fields);
var partyDetailsForm = parseForm(process.argv[2] + '/config/form-layouts/party-details-form.js', 'partyDetailsForm.js');
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

cleanUp();
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

	missingFields = removeRawTemplates(missingFields);
	printFields(fileName, missingFields, 'Missing from Index file', null);
	return missingFields;
}


function checkFieldTypes(index, indexName) {
	var fieldTypes = require(process.argv[3] + '/standard/field_types.json');
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
			var nested = getUnusedDisplayRules(field.elements, rules);
			acc.push.apply(acc, nested);
		}

		if (field.displayRule) {
			var splitRegex =  /\|\||&&/;
			var displayRules = field.displayRule.split(splitRegex);
			displayRules.forEach(function(displayRule) {
				displayRule = _.trim(displayRule);
				displayRule = displayRule.replace(/[^\w+]/g, '');
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
	var enUsGroup = enus.groups.filter(function (group) {
		return group.groupName === null;
	});

	var enusKeys = Object.keys(enUsGroup[0].subgroups[0].translations);
	var notInEnus = index.filter(function(fieldDef) {
		return !_.includes(enusKeys, fieldDef.typeOptions.picklistName);
	});
	_.remove(notInEnus, function (item) {
		return item.typeOptions.picklistName === 'case_sources';
	})
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

function removeRawTemplates (data) {
	_.remove(data, function(fieldDef) {
		return fieldDef.type === 'raw';
	});
	return data;
}

function parseForm(path, filename) {
	var form = null;
	try {
		form = require(path);
	} catch (error) {
		console.log('In here');
		var tempForm = fs.readFileSync(path, 'utf-8');
		tempForm = tempForm.split('\n');

		tempForm = tempForm.map(function (line, index, arr) {
			if (_.startsWith(_.trim(line), 'template:')) {
				line = _.replace(line, 'require(', '');
				line = _.replace(line, ')', '');
			}
			return line;
		});

		tempForm = _.join(tempForm, '\n');
		fs.writeFileSync(process.argv[3] + `/temp_files/${filename}`, tempForm);
		form = require(process.argv[3] + `/temp_files/${filename}`);
	}
	return form;
}

function cleanUp() {
	var tempDir = process.argv[3] + '/temp_files/'
	fs.readdir(tempDir, function (err, files) {
		files.forEach(function (file) {
			fs.unlink(tempDir + file), function (err) {
				if (err) console.error(err);
			}
		});
	});
}