var _ = require('lodash');
var fs = require('fs');
var path = require('path');

var caseIndex = require(process.argv[2] + '/entities/case/index.js');
var caseIndexFieldNames = getIndexFields(caseIndex.fields);
var caseCaptureForm = parseForm(process.argv[2] + '/config/form-layouts/case-capture-form.js', 'caseCaptureForm.js');
var caseOverviewForm = parseForm(process.argv[2] + '/config/form-layouts/case-overview-form.js', 'caseOverviewForm.js');
var caseRules = require(process.argv[2] + '/entities/case/rules.js');
var colors = require('colors');

var partyIndex = require(process.argv[2] + '/entities/party/index.js');
var partyIndexFieldNames = getIndexFields(partyIndex.fields);
var partyDetailsForm = parseForm(process.argv[2] + '/config/form-layouts/party-details-form.js', 'partyDetailsForm.js');
var partyRules = require(process.argv[2] + '/entities/party/rules.js');

var optionsPicklist = require(process.argv[2] + '/config/options.picklists.js');
var enus = require(process.argv[2] + '/data/translations/en_US.js');
var JSONfiles = getPicklistJSONFiles();
var fieldTypes = getFieldTypes();

checkFieldsInIndex(caseIndexFieldNames, caseCaptureForm, 'case-capture-form.js');
checkFieldsInIndex(caseIndexFieldNames, caseOverviewForm, 'case-overview-form.js');
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
picklistJSONFileExists(casePicklistDefs, 'case/index.js');

var partyPicklistDefs =  getPicklistDefs(partyIndex.fields);
picklistsDefined(partyPicklistDefs, 'party/index.js');
picklistsInOptions(partyPicklistDefs, 'party/index.js');
picklistInEn(partyPicklistDefs, 'party/index.js');
picklistJSONFileExists(partyPicklistDefs, 'party/index.js');
parsePicklists(process.argv[2]);

// Search For tabs
try {
	var tabViewPaths = getTabViews(process.argv[2] + '/public/config/options.case-details-tabs-ex.js');
	var tabFormNames = getFormConfigName(tabViewPaths);
	var tabFormsObj = getForms(process.argv[2] + '/config/form-layouts/', tabFormNames);

	tabFormsObj.forEach(function(formObj) {
		var formFile = parseForm(formObj.path, path.basename(formObj.path));
		checkFieldsInIndex(caseIndexFieldNames, formFile, path.basename(formObj.path));
		checkDisplayRulesExist(formFile.elements, caseRules, path.basename(formObj.path));
	});
} catch (err) {
	console.error(err);
}

//Search Custom Entities
try {
	var entities = readEntities(process.argv[2] + '/entities/');
	getCustomFormConfig(process.argv[2] + '/config/custom-forms/');
	matchCustomEntitiesToView(process.argv[2] + '/public/views/custom-forms/');

	var filteredList = _.filter(entities, function(entity) {
		return _.has(entity, 'formConfigName');
	});

	filteredList.forEach(function(item) {
		var customForm = require(process.argv[2] + '/config/form-layouts/' + item.formConfigName + '-form.js');
		var customIndex = require(process.argv[2] + '/entities/' + item.name + '/index.js');
		var customIndexFieldNames = getIndexFields(customIndex.fields);
		var customRules = require(process.argv[2] + '/entities/' + item.name + '/rules.js');

		checkFieldsInIndex(customIndexFieldNames, customForm, item.name + '-form.js');
		checkFieldTypes(customIndex.fields, item.name + '/index.js');
		checkDisplayRulesExist(customForm.elements, customRules, item.name + '-form.js');

		var customPicklistDefs =  getPicklistDefs(customIndex.fields);
		picklistsDefined(customPicklistDefs, item.name + '/index.js');
		picklistsInOptions(customPicklistDefs, item.name + '/index.js');
		picklistInEn(customPicklistDefs, item.name + '/index.js');
		picklistJSONFileExists(customPicklistDefs, item.name + '/index.js');
	})
} catch (err) {
	console.error(err);
}

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
	var shadyFieldTypes = index.filter(function(fieldDef) {
		return !_.includes(fieldTypes, fieldDef.type);
	});

	printFields(indexName, shadyFieldTypes, 'Shady field types', 'type');
}

function checkDisplayRulesExist(formDef, rules, fileName) {
	rules = Object.keys(rules);
	var undefinedDR = getUnusedDisplayRules(formDef, rules);

	_.remove(undefinedDR, function (dr) {
		return dr === 'isClosed';
	});

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
	printFields(fileName, notInOptions, 'Picklist missing from options.picklist', 'typeOptions', 'picklistName');
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

function parsePicklists(filePath) {
	filePath += '/data/lists/';
	fs.readdir(filePath, function (err, files) {
		if (err) { throw err }
		files.forEach(function (file) {
			var picklist = require(filePath + file);
			picklistValuesUniq(picklist, file);
		});
	})
}

function picklistValuesUniq(picklist, fileName) {
	var uniqValues = _.uniqWith(picklist, _.isEqual);

	if (picklist.length !== uniqValues.length) {
		console.log('Duplicate picklist values in ' + colors.green(fileName));
		var result = picklist.filter(function (item, index, arr) {
			var containsDup = _.some(arr.slice(index + 1), function (compItem) {
				return _.isEqual(item, compItem);
			});
			return containsDup;
		});

		result.forEach(function (item) {
			console.log(colors.red(item.value));
		});
	}
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

function getPicklistJSONFiles() {
	return fs.readdirSync(process.argv[2] + '/data/lists');
}

function getFieldTypes(){
	var fieldTypes = require(process.argv[3] + '/standard/field_types.js');

	var fieldTypesPath = process.argv[2] + '/field-types';
	if (fs.existsSync(fieldTypesPath)) {
		var files = fs.readdirSync(fieldTypesPath);

		files.forEach(function (file) {
			if (fs.existsSync(fieldTypesPath + `/${file}/index.js`)) {
				var fieldIndex = require(fieldTypesPath + `/${file}/index.js`);
				fieldTypes.push(fieldIndex.name);
			}
		})
	}

	return fieldTypes
}

function removeRawTemplates (data) {
	_.remove(data, function(fieldDef) {
		return fieldDef.type === 'raw';
	});
	return data;
}

function parseForm(filePath, filename) {
	var form = null;
	try {
		form = require(filePath);
	} catch (error) {
		var tempForm = fs.readFileSync(filePath, 'utf-8');
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

function getTabViews(filepath) {
	var tabViewPaths = fs.readFileSync(filepath, 'utf-8');
	var startString = 'require(\'';
	tabViewPaths = tabViewPaths.split('\n');

	tabViewPaths = tabViewPaths.reduce(function (acc, line) {
		if (_.includes(line, '/views/case/') && _.endsWith(line, '.js\');')) {
			line = line.substring(line.indexOf(startString) + startString.length, line.indexOf('\');'));
			line = _.replace(line, '..', process.argv[2] + '/public')
			acc.push(line);
		}
		return acc;
	}, []);
	return tabViewPaths;
}


function getFormConfigName(tabViewPaths) {
	var startString = 'formConfigName: \'';

	return tabViewPaths.reduce(function (acc, tabPath) {
		var tabViewFile = fs.readFileSync(tabPath, 'utf-8');
		tabViewFile = tabViewFile.split('\n');

		var formConfigNames = tabViewFile.forEach(function (line) {
			if (_.includes(line, 'formConfigName:')) {
				line = line.substring(line.indexOf(startString) + startString.length, line.indexOf('\','));
				acc.push({
					view: path.basename(tabPath),
					formConfigName: line
				});
			}
		});
		return acc;
	}, []);
}

function getForms(filePath, tabFormNames) {
	var files = fs.readdirSync(filePath).filter(function (filename) {
		return _.includes(filename, 'form');
	});

	var filesObj = files.map(function(filename) {
		var form = parseForm(filePath + filename, filename);
		return {
			name: form.name,
			path: filePath + filename
		}
	});

	var tabForms = tabFormNames.reduce(function(acc, name) {
		var obj = _.find(filesObj, {name: name.formConfigName});
		if (obj) {
			acc.push(obj);
		}
		return acc;
	}, []);
	return tabForms;
}

function readEntities(entityPath) {
	var entityDir = fs.readdirSync(entityPath, 'utf8');
	return entityDir.reduce(function(acc, entityName) {
		var entityIndexPath = path.join(entityPath, entityName, 'index.js');
		try {
			fs.statSync(entityIndexPath);
		} catch (err) {
			return acc;
		}
		var entityIndexFile = require(entityIndexPath);
		acc.push(entityIndexFile.entity);
		return acc;
	}, []);
}

function matchCustomEntitiesToView(customFormsViewsPath) {
	try {
		fs.statSync(customFormsViewsPath);
	} catch (err) {
		console.log(err)
		return;
	}

	var customViewNames = fs.readdirSync(customFormsViewsPath, 'utf8');
	customViewNames = customViewNames.filter(function(filename) {
		return !_.startsWith(filename, '.')
	}).map(function(filename) {
		return path.join(customFormsViewsPath, filename);
	});

	var customFormNames = getFormConfigName(customViewNames);
	customFormNames.forEach(function(customFormConfigName) {
		_.forEach(entities, function(entity) {
			if (entity.view === customFormConfigName.view) {
				entity.formConfigName = customFormConfigName.formConfigName;
			}
		})
	})
}

function matchCustomEntitiesToConfig(customFormConfigPaths) {
	customFormConfigPaths.forEach(function(customFormConfigPath) {
		customConfigFile = require(customFormConfigPath);
		var customEntityIndex = _.findIndex(entities, customConfigFile.entity);
		if (customEntityIndex >= 0) {
			entities[customEntityIndex].view = customConfigFile.view;
		}
	});
}

function getCustomFormConfig(customFormsConfigPath) {
	var result = [];
	try {
		fs.statSync(customFormsConfigPath);
	} catch (err) {
		return result;
	}

	var customConfig = fs.readdirSync(customFormsConfigPath);
	var customFormConfigPaths = customConfig.reduce(function(acc, filename) {
		if (!_.includes(filename, '.js')) {
			return acc;
		}
		var configPath = path.join(customFormsConfigPath, filename);
		acc.push(configPath);
		return acc;
	}, []);

	matchCustomEntitiesToConfig(customFormConfigPaths);
}