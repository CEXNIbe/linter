var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var PrintModule = require(__dirname + '/printModule.js');
var excludeModule = require(__dirname + '/excludeModule.js');
var defaultsModule = require(__dirname + '/defaults/defaults.js');


var optionsPicklist = require(process.argv[2] + '/config/options.picklists.js');
var configEnUs = require(process.argv[2] + '/data/translations/en_US.js');
var platformEnUs = require(process.argv[2] + '/node_modules/isight/script/data/translations/en_US.js')
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
		if (entityName === 'index-ui.js') return acc;

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

	var picklists = getPicklistDefs(indexFile.fields, indexNameWithPath);
	checkPicklistTypeOptions(picklists, indexNameWithPath);
	picklistsDefined(picklists, indexNameWithPath);
	picklistsInOptions(picklists, indexNameWithPath);
	picklistInEn(picklists, indexNameWithPath);
	picklistJSONFileExists(picklists, indexNameWithPath);
	picklistDependenciesMatchUp(picklists, indexNameWithPath);

	var radios = getRadioDefs(indexFile.fields, indexNameWithPath);
	checkRadioTypeOptions(radios, indexNameWithPath);
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

	var missingFields = _.reduce(form, function (acc, field) {
			if (field.type == 'section') {
				var sectionFields = checkFormFieldsInIndex(indexFieldNames, field);
				if (sectionFields.length > 0) {
					sectionFields.forEach(function(sectionField) {
						acc.push(sectionField);
					});
				}
			} else if (!_.includes(indexFieldNames, field.field)) {
				acc.push(field)
			}
			return acc;
		}, []);

	if (fileName) {
		missingFields = removeRawTemplates(missingFields);
		PrintModule.printFields(fileName, missingFields, 'Missing from Index file', null);
	}
	return missingFields;
}

function checkFieldTypes(index, indexName) {
	var shadyFieldTypes = _.filter(index, (fieldDef) => {
		return !_.includes(fieldTypes, fieldDef.type);
	});

	PrintModule.printFields(indexName, shadyFieldTypes, 'Shady field types', 'type');
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
			var splitRegex =  /\|\||&&/;
			var displayRules = field.displayRule.split(splitRegex);
			_.forEach(displayRules, (displayRule) => {
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

function getPicklistDefs(index, fileName) {
	var picklistFields = _.filter(index, (fieldDef) => {
		return fieldDef.type === 'picklist' || fieldDef.type === 'picklist[]';
	});
	return picklistFields;
}

function checkPicklistTypeOptions(picklistFields, fileName) {
	var result = _.reduce(picklistFields, (acc, field) => {
		if (_.has(field.typeOptions, 'picklistDependencies')) {
			if(typeof field.typeOptions.picklistDependencies !== 'object') {
				acc.push(field);
			}
		}
		return acc;
	}, []);

	PrintModule.printFields(fileName, result, 'picklistDependencies should be an array', 'typeOptions', 'picklistDependencies');
}

function picklistsDefined(picklistIndex, fileName) {
	var missingPicklistName = _.filter(picklistIndex, (fieldDef) => {
		return !_.has(fieldDef, 'typeOptions.picklistName')
	})
	PrintModule.printFields(fileName, missingPicklistName, 'Picklist missing picklistName', 'typeOptions', 'picklistName');
}

function picklistsInOptions(picklistIndex, fileName) {
	var optionsKeys = Object.keys(optionsPicklist);
	var notInOptions = _.filter(picklistIndex, (fieldDef) => {
		return !_.includes(optionsKeys, fieldDef.typeOptions.picklistName);
	});

	var itemsToExclude = excludeModule.picklists(fileName);
	_.remove(notInOptions, (fieldDef) => {
		return _.includes(itemsToExclude, fieldDef.typeOptions.picklistName);
	});
	PrintModule.printFields(fileName, notInOptions, 'Picklist missing from options.picklist', 'typeOptions', 'picklistName');
}

function picklistJSONFileExists(picklistIndex, fileName) {
	var notInFiles = _.filter(picklistIndex, (fieldDef) => {
		return !_.includes(JSONfiles, fieldDef.typeOptions.picklistName + ".json");
	});

	var itemsToExclude = excludeModule.picklists(fileName);
	_.remove(notInFiles, (fieldDef) => {
		return _.includes(itemsToExclude, fieldDef.typeOptions.picklistName);
	});
	PrintModule.printFields(fileName, notInFiles, 'Picklist .json file missing from data/lists', 'typeOptions', 'picklistName');
}

function picklistInEn(index, fileName) {
	var configTranslations = _.filter(configEnUs.groups, (group) => {
		return group.groupName === null;
	});

	var platformTranslations = _.filter(platformEnUs.groups, (group) => {
		return group.groupName === null;
	});

	var translations = _.merge(
		configTranslations[0].subgroups[0].translations,
		platformTranslations[0].subgroups[0].translations
	);

	var enusKeys = Object.keys(translations);
	var notInEnus = _.filter(index, (fieldDef) => {
		return !_.includes(enusKeys, fieldDef.typeOptions.picklistName);
	});

	PrintModule.printFields(fileName, notInEnus, 'Picklist translations missing form en_US', 'typeOptions', 'picklistName');
}

function picklistDependenciesMatchUp(picklistIndex, fileName) {
	var parentNotPicklist = [];
	var dependenciesMisMatch = [];

	_.forEach(picklistIndex, (fieldDef) => {
		var fieldDefClone = _.cloneDeep(fieldDef);
		if (!_.has(fieldDefClone.typeOptions, 'picklistDependencies')) return;

		var parents = fieldDefClone.typeOptions.picklistDependencies;
		var parent = parents.pop();
		var parentFielfDef = _.filter(picklistIndex, def => def.field === parent);
		if (_.isEmpty(parentFielfDef)) {
			parentNotPicklist.push(fieldDef);
			return;
		}

		parentFielfDef = parentFielfDef[0];
		if (_.has(parentFielfDef.typeOptions, 'picklistDependencies') &&
			!_.isEqual(parents, parentFielfDef.typeOptions.picklistDependencies)) {
 			dependenciesMisMatch.push(fieldDef);
		}
	});

	PrintModule.printFields(fileName, parentNotPicklist, 'PicklistDependencies is not a picklist', 'typeOptions', 'picklistDependencies');
	PrintModule.printFields(fileName, dependenciesMisMatch, `PicklistDependencies doesn't match up with parents dependency` , 'typeOptions', 'picklistDependencies');
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
	var result = _.reduce(radios, (acc, field) => {
		if (!_.has(field, 'typeOptions.radios')) {
			acc.missingRadiosOption.push(field);
		} else if (!_.isArray(field.typeOptions.radios)) {
			acc.radiosOptionsNotArray.push(field);
		}

		return acc;
	}, { missingRadiosOption: [], radiosOptionsNotArray: [] });

	PrintModule.printRadios(fileName, 'Radios missing typeOptions.radios attribute', result.missingRadiosOption, ['field', 'typeOptions.radios']);
	PrintModule.printRadios(fileName, 'typeOptions.radios is not an array', result.radiosOptionsNotArray, ['field', 'typeOptions.radios']);
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

function removeRawTemplates (data) {
	_.remove(data, (fieldDef) => fieldDef.type === 'raw' );
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