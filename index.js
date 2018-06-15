var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var PrintModule = require(__dirname + '/printModule.js');
var excludeModule = require(__dirname + '/excludeModule.js');
var defaultsModule = require(__dirname + '/defaults/defaults.js');


var optionsPicklist = require(process.argv[2] + '/config/options.picklists.js');
var translations = getMergedTranslations();
var JSONfiles = getPicklistJSONFiles();
var fieldTypes = getFieldTypes();


var entities = getEntities();
var formNames = getFormNames();
var formMapping = getFormMapping(formNames);

_.forEach(entities, (entity) => testIndexFile(entity) );

_.forEach(formNames, (form) => testForm(form) );

_.forEach(defaultsModule.pseudoForm, (form) => {
	testForm(form.name, path.join(process.argv[2], form.path));
});

parsePicklists(path.join(process.argv[2], 'data', 'lists'));

PrintModule.printErrorsFound();


/* --------------------------------------------------------------------
							FUNCTIONS
----------------------------------------------------------------------*/

function getEntities() {
	var entitiesPath = path.join(process.argv[2], 'entities');
	var entityDir = fs.readdirSync(entitiesPath, 'utf8');

	return _.reduce(entityDir, (acc, entityName) => {
		if (entityName === 'index-ui.js' || _.startsWith(entityName, '.')) return acc;

		try {
			var entityIndexPath = path.join(entitiesPath, entityName, 'index.js');
			fs.statSync(entityIndexPath);

			var entityIndex = require(entityIndexPath);
			var entityMapper = entityIndex.entity;
			entityMapper.path = path.join(entitiesPath, entityName);
			entityMapper.indexFile = entityIndex;
			entityMapper.indexFieldNames = getFieldNames(entityIndex.fields);

			acc[entityMapper.name] = entityMapper;

		} catch (err) {
			console.error(`Error in file ${entityName}`);
			console.error(err);
			console.error(`Moving on...\n`);
		}

		return acc;
	}, {});
}

function getFormNames() {
	var formPath = path.join(process.argv[2], 'config', 'form-layouts');
	var forms = fs.readdirSync(formPath, 'utf8');
	return _.filter(forms, (form) => {
		return path.extname(form) === '.js' && form !== 'index-ui.js'
			&& !_.includes(excludeModule.formsToExclude, form);
	});
}

function getFormMapping(forms) {
	var formPath = path.join(process.argv[2], 'config', 'form-layouts');
	return _.reduce(forms, (acc, file) => {
		try {
			var formName = parseForm(path.join(formPath, file), file).name;
			var entityName = formName.slice(0, formName.indexOf('-'));

			if (entities[entityName]) {
				acc[formName] = entityName;
			} else {
				acc[formName] = null;
			}
		} catch (err) {
			console.error(`Error in file ${file}`);
			console.error(err);
			console.error(`Moving on...\n`);
		}

		return acc;
	}, defaultsModule.formMapping);
}


function testIndexFile(entity) {
	var indexNameWithPath = path.join(entity.name, 'index.js');
	var indexFile = entity.indexFile;
	var indexFieldNames = entity.indexFieldNames;
	checkFieldTypes(indexFile.fields, indexNameWithPath);
	checkValidation(indexFile, indexFieldNames, path.join(entity.name, 'validation.js'));

	var picklists = getPicklistDefs(indexFile.fields, indexNameWithPath);
	picklists = checkPicklistHasTypeOptions(picklists, indexNameWithPath);
	checkPicklistDependeciesIsArray(picklists, indexNameWithPath);
	picklistsHasPicklistName(picklists, indexNameWithPath);
	picklistsInOptions(picklists, indexNameWithPath);
	picklistInEn(picklists, indexNameWithPath);
	picklistJSONFileExists(picklists, indexNameWithPath);
	picklistDependenciesMatchUp(picklists, indexNameWithPath);

	var radios = getRadioDefs(indexFile.fields, indexNameWithPath);
	checkRadioTypeOptions(radios, indexNameWithPath);
	checkRadioCaptionsHaveTranslations(radios, indexNameWithPath);
}


function testForm(formName, formPath) {
	// isPseudoForm if not official form, like case-tombstone
	var isPseudoForm = !!formPath;
	try {
		if (!isPseudoForm) formPath = path.join(process.argv[2], 'config', 'form-layouts', formName);

		var form = parseForm(formPath, formName);

		var entity;
		if (isPseudoForm) {
			entity = entities[formMapping[formName]];
		} else {
			entity = entities[formMapping[form.name]];
		}

		if (!entity) return;

		entityIndexNames = entity.indexFieldNames;

		checkFormFieldsInIndex(entityIndexNames, form, formName);

		if (!entity.indexFile.rules) return;

		if (isPseudoForm) {
			checkDisplayRulesExist(form, entity.indexFile.rules, formName);
		} else {
			checkDisplayRulesExist(form.elements, entity.indexFile.rules, formName);
		}
	} catch (err) {
		console.error(`Error Parsing form ${formName}`);
		console.error(err);
		console.error(`Moving on...\n`);
	}

}

function checkFormFieldsInIndex(indexFieldNames, form, fileName) {
	if (!_.isArray(form) && _.has(form, 'elements')) {
		form = form.elements;
	}
	var attributes = ['field'];

	var missingFields = _.reduce(form, function (acc, field) {
			if (field.type === 'section') {
				var sectionFields = checkFormFieldsInIndex(indexFieldNames, field);
				if (!_.isEmpty(sectionFields)) {
					sectionFields.forEach(function(sectionField) {
						acc.push(sectionField);
					});
				}
			} else if (!_.includes(indexFieldNames, field.field)) {
				if (fileName === 'training-details-form.js') console.log(field);
				acc.push({ fieldDef: field, attributes });
			}
			return acc;
		}, []);

	if (fileName) {
		missingFields = removeRawTemplates(missingFields);
		PrintModule.printFields(fileName, 'Missing from Index file', missingFields);
	}
	return missingFields;
}

function checkFieldTypes(index, indexName) {
	var attributes = ['field', 'type'];

	var shadyFieldTypes = _.reduce(index, (acc, fieldDef) => {
		if (!_.includes(fieldTypes, fieldDef.type)) {
			acc.push({ fieldDef, attributes })
		}
		return acc;
	}, []);

	PrintModule.printFields(indexName, 'Shady field types', shadyFieldTypes);
}

function checkValidation(indexFile, indexFieldNames, fileName) {
	var validation = indexFile.validation;
	var fieldsToExclude = excludeModule.validationFieldsToExclude(fileName)
	if (!validation) return;

	if (_.has(validation, 'mandatory$')) {
		var fieldNoExist = _.reduce(validation['mandatory$'], (acc, value) => {
			if (!_.includes(indexFieldNames, value) && !_.includes(fieldsToExclude, value)) acc.push(value);
			return acc;
		}, []);

		PrintModule.printArrayList(fileName, fieldNoExist, `mandatory$ fields don't exist`);
	}

	if (_.has(validation, 'dependentMandatory$')) {
		var rules = Object.keys(indexFile.rules);
		var missingRules = [];

		fieldNoExist = _.reduce(validation['dependentMandatory$'], (acc, validationRule) => {
			// Check conditions exist
			// _.forEach(validationRule.condition, (condition) => {
				missingRules = _.concat(missingRules, getMissingRules(rules, validationRule.condition));
			// });

			_.forEach(validationRule.fields, (field) => {
				if (!_.includes(indexFieldNames, field) && !_.includes(fieldsToExclude, field)) acc.push(field);
			});
			return acc;
		}, []);

		PrintModule.printArrayList(fileName, fieldNoExist, `dependentMandatory$ fields don't exist`);
		PrintModule.printArrayList(fileName, missingRules, `condition missing from rules`);
	}
}

function checkDisplayRulesExist(formDef, rules, fileName) {
	rules = Object.keys(rules);
	var undefinedDR = getUnusedDisplayRules(formDef, rules);
	undefinedDR = _.uniq(undefinedDR);

	var itemsToExclude = excludeModule.displayRulesToExclude(fileName);
	_.remove(undefinedDR, (rule) => _.includes(itemsToExclude, rule));

	PrintModule.printArrayList(fileName, undefinedDR, 'Undefined display rules')
}

function getUnusedDisplayRules(formDef, rules) {
	return _.reduce(formDef, (acc, field) => {
		if (field.elements) {
			var nested = getUnusedDisplayRules(field.elements, rules);
			acc.push.apply(acc, nested);
		}

		if (field.displayRule) {
			acc = _.concat(acc, getMissingRules(rules, field.displayRule));
		}

		return acc;
	}, []);
}

function getMissingRules(ruleKeys, displayRule) {
	var splitRegex =  /\|\||&&/;
	var displayRules = displayRule.split(splitRegex);
	return _.reduce(displayRules, (acc, rule) => {
		rule = _.trim(rule);
		rule = rule.replace(/[^\w+]/g, '');
		if (!_.includes(ruleKeys, rule)) acc.push(rule);

		return acc;
	}, []);
}

function getPicklistDefs(index, fileName) {
	var picklistFields = _.filter(index, (fieldDef) => {
		return fieldDef.type === 'picklist' || fieldDef.type === 'picklist[]';
	});
	return picklistFields;
}

function checkPicklistHasTypeOptions(picklistFields, fileName) {
	var attributes = ['field', 'typeOptions'];
	var noTypeOption = [];

	var result = _.reduce(picklistFields, (acc, fieldDef) => {
		if (_.has(fieldDef, 'typeOptions')) {
			acc.push(fieldDef);
		} else {
			noTypeOption.push({ fieldDef, attributes });
		}

		return acc;
	}, []);

	PrintModule.printFields(fileName, 'picklist missing typeOptions', noTypeOption);
	return result;
}

function checkPicklistDependeciesIsArray(picklistFields, fileName) {
	var attributes = ['field', 'typeOptions.picklistDependencies'];

	var result = _.reduce(picklistFields, (acc, fieldDef) => {
		if (_.has(fieldDef.typeOptions, 'picklistDependencies')) {
			if(!_.isArray(fieldDef.typeOptions.picklistDependencies)) {
				acc.push({ fieldDef, attributes });
			}
		}
		return acc;
	}, []);

	PrintModule.printFields(fileName, 'picklistDependencies should be an array', result);
}

function picklistsHasPicklistName(picklistIndex, fileName) {
	var attributes = ['field', 'typeOptions.picklistName'];

	var missingPicklistName = _.reduce(picklistIndex, (acc, fieldDef) => {
		if (!_.has(fieldDef, 'typeOptions.picklistName')) acc.push({ fieldDef, attributes });

		return acc;
	}, []);
	PrintModule.printFields(fileName, 'Picklist missing picklistName', missingPicklistName);
}

function picklistsInOptions(picklistIndex, fileName) {
	var attributes = ['field', 'typeOptions.picklistName'];
	var itemsToExclude = excludeModule.picklists(fileName);

	var optionsKeys = Object.keys(optionsPicklist);
	var notInOptions = _.reduce(picklistIndex, (acc, fieldDef) => {
		if (!_.includes(optionsKeys, fieldDef.typeOptions.picklistName) &&
			!_.includes(itemsToExclude, fieldDef.typeOptions.picklistName)) {
			acc.push({ fieldDef, attributes });
		}

		return acc;
	}, []);

	PrintModule.printFields(fileName, 'Picklist missing from options.picklist', notInOptions, 'typeOptions', 'picklistName');
}

function picklistJSONFileExists(picklistIndex, fileName) {
	var attributes = ['field', 'typeOptions.picklistName'];
	var itemsToExclude = excludeModule.picklists(fileName);

	var notInFiles = _.reduce(picklistIndex, (acc, fieldDef) => {
		if (!_.includes(JSONfiles, fieldDef.typeOptions.picklistName + ".json") &&
			!_.includes(itemsToExclude, fieldDef.typeOptions.picklistName)) {
			acc.push({ fieldDef, attributes });
		}

		return acc;
	}, []);

	PrintModule.printFields(fileName, 'Picklist .json file missing from data/lists', notInFiles);
}

function picklistInEn(index, fileName) {
	var attributes = ['field', 'typeOptions.picklistName'];

	var enusKeys = Object.keys(translations);
	var notInEnus = _.reduce(index, (acc, fieldDef) => {
		if (!_.includes(enusKeys, fieldDef.typeOptions.picklistName)) acc.push({ fieldDef, attributes });
		return acc;
	}, []);

	PrintModule.printFields(fileName, 'Picklist translations missing form en_US', notInEnus);
}

function picklistDependenciesMatchUp(picklistIndex, fileName) {
	var attributes = ['field', 'typeOptions.picklistDependencies'];

	var parentNotPicklist = [];
	var dependenciesMisMatch = [];

	_.forEach(picklistIndex, (fieldDef) => {
		var fieldDefClone = _.cloneDeep(fieldDef);
		if (!_.has(fieldDefClone.typeOptions, 'picklistDependencies')) return;

		var parents = fieldDefClone.typeOptions.picklistDependencies;
		if (!_.isArray(parents)) return;

		var parent = parents.pop();
		var parentFielfDef = _.filter(picklistIndex, def => def.field === parent);
		if (_.isEmpty(parentFielfDef)) {
			parentNotPicklist.push({ fieldDef, attributes });
			return;
		}

		parentFielfDef = parentFielfDef[0];
		if (_.has(parentFielfDef.typeOptions, 'picklistDependencies') &&
			!_.isEqual(parents, parentFielfDef.typeOptions.picklistDependencies)) {
 			dependenciesMisMatch.push({ fieldDef, attributes });
		}
	});

	PrintModule.printFields(fileName, 'PicklistDependencies is not a picklist', parentNotPicklist);
	PrintModule.printFields(fileName, `PicklistDependencies doesn't match up with parents dependency`, dependenciesMisMatch);
}

function parsePicklists(dataPath) {
	try {
		var files = fs.readdirSync(dataPath);
		_.forEach(files, (file) => {
			if (path.extname(file) != '.json') return;

			var picklist = require(path.join(dataPath, file));
			picklistValuesUniq(picklist, file);
			picklistHasWhiteSpace(picklist, file);
		});
	} catch (err) {
		console.error(`Error Parsing piclists`);
		console.error(err);
		console.error(`Moving on...\n`);
	}
}

function picklistValuesUniq(picklist, fileName) {
	var uniqValues = _.uniqWith(picklist, _.isEqual);

	if (picklist.length !== uniqValues.length) {
		var result = _.reduce(picklist, (acc, item, index, arr) => {
			var containsDup = _.some(arr.slice(index + 1), (compItem) => {
				return _.isEqual(item, compItem);
			});

			if (containsDup) {
				acc.push(item.value);
			}
			return acc;
		}, []);

		PrintModule.printArrayList(fileName, result, 'Duplicate picklist values');
	}
}

function picklistHasWhiteSpace(picklist, fileName) {
	var whiteSpaceValues = _.reduce(picklist, (acc, item) => {
		var itemKeys = _.keys(item);
		var result = {
			offending: []
		};
		_.forEach(itemKeys, (itemKey) => {
			var offending = {
				key: itemKey,
				keyOffending: false,
				valueOffending: false
			};

			if (itemKey !== _.trim(itemKey) && (typeof itemKey === 'string')) {
				offending.keyOffending = true;
			}

			if (typeof item[itemKey] === 'string') {
				var trimmedValue = _.trim(item[itemKey]);
				if (trimmedValue !== item[itemKey]) {
					offending.valueOffending = true;
				}
			} else if (typeof item[itemKey] === 'object') {
				item[itemKey].forEach(function(parentValue) {
					if (_.trim(parentValue) !== parentValue) {
						offending.valueOffending = true;
					}
				})
			}

			if (offending.keyOffending || offending.valueOffending) {
				result.offending = offending;
				result.value = item;
				acc.push(result);
			}
		});
		return acc;
	}, []);

	PrintModule.printPicklists(fileName, whiteSpaceValues, 'Picklist has white space');
}

function checkRadioTypeOptions(radios, fileName) {
	var attributes = ['field', 'typeOptions.radios'];

	var result = _.reduce(radios, (acc, fieldDef) => {
		if (!_.has(fieldDef, 'typeOptions.radios')) {
			acc.missingRadiosOption.push({ fieldDef, attributes });
		} else if (!_.isArray(fieldDef.typeOptions.radios)) {
			acc.radiosOptionsNotArray.push({ fieldDef, attributes });
		}

		return acc;
	}, { missingRadiosOption: [], radiosOptionsNotArray: [] });

	PrintModule.printFields(fileName, 'Radios missing typeOptions.radios attribute', result.missingRadiosOption);
	PrintModule.printFields(fileName, 'typeOptions.radios is not an array', result.radiosOptionsNotArray);
}

function checkRadioCaptionsHaveTranslations(radios, fileName) {
	var enusKeys = Object.keys(translations);
	var radiosWithoutCaption = [];

	var result = _.reduce(radios, (acc, fieldDef) => {
		if (!_.has(fieldDef, 'typeOptions.radios') || !_.isArray(fieldDef.typeOptions.radios)) return;

		_.forEach(fieldDef.typeOptions.radios, (radioButton, index) => {
			if (!_.has(radioButton, 'caption')) {
				radiosWithoutCaption.push({ fieldDef, attributes: ['field', `typeOptions.radios.${index}.caption`], color: 'yellow'})
				return;
			}

			if (!_.includes(enusKeys, radioButton.caption)) {
				acc.push({ fieldDef, attributes: ['field', `typeOptions.radios.${index}.caption`] });
			}
		});

		return acc;
	}, []);

	PrintModule.printFields(fileName, 'Radio caption missing translation', result);
	PrintModule.printFields(fileName, 'Radio caption missing translation', radiosWithoutCaption);
}

function getFieldNames(index) {
	return _.map(index, (f) => f.field );
}

function getPicklistJSONFiles() {
	return fs.readdirSync(process.argv[2] + '/data/lists');
}

function getFieldTypes(){
	var fieldTypes = require(__dirname + '/defaults/field_types.js');

	var fieldTypesPath = process.argv[2] + '/field-types';
	if (fs.existsSync(fieldTypesPath)) {
		var files = fs.readdirSync(fieldTypesPath);

		_.forEach(files, (file) => {
			if (fs.existsSync(fieldTypesPath + `/${file}/index.js`)) {
				var fieldIndex = require(fieldTypesPath + `/${file}/index.js`);
				fieldTypes.push(fieldIndex.name);
			}
		})
	}

	return fieldTypes
}

function getRadioDefs(index, fileName) {
	var picklistFields = _.filter(index, (fieldDef) => {
		return fieldDef.type === 'radio';
	});
	return picklistFields;
}

function getMergedTranslations() {
	var configEnUs = require(process.argv[2] + '/data/translations/en_US.js');
	var platformEnUs = require(process.argv[2] + '/node_modules/isight/script/data/translations/en_US.js');

	var configTranslations = _.filter(configEnUs.groups, (group) => {
		return group.groupName === null;
	});

	var platformTranslations = _.filter(platformEnUs.groups, (group) => {
		return group.groupName === null;
	});

	return _.merge(configTranslations[0].subgroups[0].translations, platformTranslations[0].subgroups[0].translations);
}

function removeRawTemplates (data) {
	_.remove(data, (option) => option.fieldDef.type === 'raw' );
	return data;
}

function parseForm(filePath, filename) {
	var form = null;
	try {
		form = require(filePath);
	} catch (error) {
		var tempForm = fs.readFileSync(filePath, 'utf-8');
		tempForm = tempForm.split('\n');

		tempForm = _.map(tempForm, (line, index, arr) => {
			if (_.startsWith(_.trim(line), 'template:')) {
				line = _.replace(line, 'require(', '');

				if (line.match(/(\)|\),)$/)) {
					line = _.replace(line, ')', '');
				} else {
					var nextLine = arr[index+1];
					if (nextLine.match(/(\)|\),)$/)) {
						arr[index+1] = _.replace(nextLine, ')', '');
					}
				}

			}
			return line;
		});

		tempForm = _.join(tempForm, '\n');
		fs.writeFileSync(__dirname + `/temp_files/${filename}`, tempForm);
		form = require(__dirname + `/temp_files/${filename}`);
	}
	return form;
}