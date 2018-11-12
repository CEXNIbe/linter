let _ = require('lodash');
let fs = require('fs');
let path = require('path');
let PrintModule = require(__dirname + '/modules/printModule.js');
let excludeModule = require(__dirname + '/modules/excludeModule.js');
let defaultsModule = require(__dirname + '/modules/defaults.js');
let utils = require(__dirname + '/modules/utils.js')


let optionsPicklist = require(process.argv[2] + '/config/options.picklists.js');

const platformEnUsPath = path.join(process.argv[2], 'node_modules/isight/script/data/translations/en_US.js');
const configEnUsPath = path.join(process.argv[2], 'data/translations/en_US.js');
let translations = utils.mergeTranslations(platformEnUsPath, configEnUsPath);
let JSONfiles = getPicklistJSONFiles();
let fieldTypes = getFieldTypes();


let formSectionCaptions;
let formFileNameMapping = {};
let entities = getEntities();
let formNames = getFormNames();
let formMapping = getFormMapping(formNames);

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

/**
*	Retrieves the entities listed in the config project
*	@returns: object with entities and properties
**/
function getEntities() {
	const entitiesPath = path.join(process.argv[2], 'entities');
	const entityDir = fs.readdirSync(entitiesPath, 'utf8');

	return _.reduce(entityDir, (acc, entityName) => {
		if (entityName === 'index-ui.js' || _.startsWith(entityName, '.')) return acc;

		try {
			const entityIndexPath = path.join(entitiesPath, entityName, 'index.js');
			fs.statSync(entityIndexPath);

			const entityIndex = require(entityIndexPath);
			const entityMapper = entityIndex.entity;
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

/**
*	Retrieves the forms listed in the project form-layouts folder
*	See exclude modules for forms excluded
*	@returns: array containing the forms
**/
function getFormNames() {
	const formPath = path.join(process.argv[2], 'config', 'form-layouts');
	const forms = fs.readdirSync(formPath, 'utf8');
	return _.filter(forms, (form) => {
		return path.extname(form) === '.js' && form !== 'index-ui.js'
			&& !_.includes(excludeModule.formsToExclude(), form);
	});
}

/**
*	Builds a mapping of form to their entities
*		based on the entity prefix on the form name ('case'-capture-fom)
*	@returns: object with the form name as key & entity as value
*		also includes forms not in the form-layout dir, see defaultsModule.formMapping
*		e.g. { 'case-capture': 'case' }
**/
function getFormMapping(forms) {
	const formPath = path.join(process.argv[2], 'config', 'form-layouts');
	return _.reduce(forms, (acc, file) => {
		try {
			const formName = utils.parseForm(path.join(formPath, file), file).name;
			const entityName = formName.slice(0, formName.indexOf('-'));
			formFileNameMapping[file] = formName;

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

/**
*	Checks an entity file for errors.
*	@param entity: the entity file to check for errors
**/
function testIndexFile(entity) {
	const indexNameWithPath = path.join(entity.name, 'index.js');
	const indexFile = entity.indexFile;
	const indexFieldNames = entity.indexFieldNames;
	checkFieldTypes(indexFile.fields, indexNameWithPath);
	checkValidation(indexFile, indexFieldNames, path.join(entity.name, 'validation.js'));
	checkLengthOfFieldNames(indexFieldNames, indexNameWithPath);

	let picklists = getPicklistDefs(indexFile.fields, indexNameWithPath);
	picklists = checkPicklistHasTypeOptions(picklists, indexNameWithPath);
	checkPicklistDependeciesIsArray(picklists, indexNameWithPath);
	picklistsHasPicklistName(picklists, indexNameWithPath);
	picklistsInOptions(picklists, indexNameWithPath);
	picklistInEn(picklists, indexNameWithPath);
	picklistJSONFileExists(picklists, indexNameWithPath);
	picklistDependenciesMatchUp(picklists, indexNameWithPath);

	const radios = getRadioDefs(indexFile.fields, indexNameWithPath);
	checkRadioTypeOptions(radios, indexNameWithPath);
	checkRadioCaptionsHaveTranslations(radios, indexNameWithPath);

	displayRulesOfValidationFields(indexFile, indexNameWithPath);
}

/**
*	Checks a form file for errors.
*	@param formName: the name of the form to check (e.g. case-capture-form.js)
*	@param formPath: the path of the form to check (e.g. only provided for forms not in the form-layout dir)
**/
function testForm(formName, formPath) {
	// isPseudoForm if not official form, like case-tombstone
	const isPseudoForm = !!formPath;
	try {
		if (!isPseudoForm) formPath = path.join(process.argv[2], 'config', 'form-layouts', formName);

		const form = utils.parseForm(formPath, formName);

		let entity;
		if (isPseudoForm) {
			entity = entities[formMapping[formName]];
		} else {
			entity = entities[formMapping[form.name]];
		}

		if (!entity) return;

		entityIndexNames = entity.indexFieldNames;

		formSectionCaptions = [];
		checkFormFieldsInIndex(entityIndexNames, form, formName);
		checkSectionCaptionsHaveTranslations(formSectionCaptions, formName);

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

/**
*	Checks if the fields in a form are also in its index file
*	@param indexFieldNames: an array with the list of fields in the index file
*	@param form: the form to check
*	@param fileName: the name of form
**/
function checkFormFieldsInIndex(indexFieldNames, form, fileName) {
	if (!_.isArray(form) && _.has(form, 'elements')) {
		form = form.elements;
	}
	const attributes = ['field'];

	let missingFields = _.reduce(form, (acc, field) => {
			if (field.type === 'section') {
				if (field.caption) formSectionCaptions.push(field.caption);
				const sectionFields = checkFormFieldsInIndex(indexFieldNames, field);
				if (!_.isEmpty(sectionFields)) {
					sectionFields.forEach((sectionField) => {
						acc.push(sectionField);
					});
				}
			} else if (!_.includes(indexFieldNames, field.field)) {
				acc.push({ fieldDef: field, attributes });
			}
			return acc;
		}, []);

	if (fileName) {
		missingFields = utils.removeRawTemplates(missingFields);
		PrintModule.printFields(fileName, 'Missing from Index file', missingFields);
	}
	return missingFields;
}

/**
*	Checks sections captions have translations
*	@param formSectionCaptions: the captions of the sections to check
*	@param formName: the name of the form the captions are on
**/
function checkSectionCaptionsHaveTranslations(formSectionCaptions, formName) {
	const translationKeys = Object.keys(translations);
	const result = _.filter(formSectionCaptions, (sectionCaption) => {
		return !_.includes(translationKeys, sectionCaption);
	});

	PrintModule.printArrayList(formName, result, `section translations doesn't exist`);
}

/**
*	Checks the types of the fields in an index file
*	@param index: the index file to check
*	@param indexName: the name of the index file
**/
function checkFieldTypes(index, indexName) {
	const attributes = ['field', 'type'];

	const shadyFieldTypes = _.reduce(index, (acc, fieldDef) => {
		if (!_.includes(fieldTypes, fieldDef.type)) {
			acc.push({ fieldDef, attributes })
		}
		return acc;
	}, []);

	PrintModule.printFields(indexName, 'Shady field types', shadyFieldTypes);
}

/**
*	Compares the displayRule in form to the the validation conditions
*	Checks if mandatory$ fields in the validation file have a displayRule
*	Checks if the dependentMandatory$ fields have different conditions than
*		the displayRules in the form
*	@param indexFile: the entity index file (which has the validation attribute)
*	@param indexFieldNames: the names of the fields in the index file
*	@param fileName: the name of the form
**/
function checkValidation(indexFile, indexFieldNames, fileName) {
	const validation = indexFile.validation;
	const fieldsToExclude = excludeModule.validationFieldsToExclude(fileName);
	const conditionsToExclude = excludeModule.validationConditionsToExclude(fileName);
	if (!validation) return;

	if (_.has(validation, 'mandatory$')) {
		const fieldNoExist = _.reduce(validation['mandatory$'], (acc, value) => {
			if (!_.includes(indexFieldNames, value) && !_.includes(fieldsToExclude, value)) acc.push(value);
			return acc;
		}, []);

		PrintModule.printArrayList(fileName, fieldNoExist, `mandatory$ fields don't exist`);
	}

	if (_.has(validation, 'dependentMandatory$')) {
		const rules = Object.keys(indexFile.rules);
		let missingRules = [];

		fieldNoExist = _.reduce(validation['dependentMandatory$'], (acc, validationRule) => {
			missingRules = _.concat(missingRules, getMissingRules(rules, validationRule.condition));
			missingRules = _.remove(missingRules, (value) => _.includes(conditionsToExclude));

			_.forEach(validationRule.fields, (field) => {
				if (!_.includes(indexFieldNames, field) && !_.includes(fieldsToExclude, field)) acc.push(field);
			});
			return acc;
		}, []);

		PrintModule.printArrayList(fileName, fieldNoExist, `dependentMandatory$ fields don't exist`);
		PrintModule.printArrayList(fileName, missingRules, `condition missing from rules`);
	}
}

/**
*	Checks if the field names in the index file are too long
*	PSQL has a max identifier lenght of 63 characters, longer columns names will be truncated
*	@param indexFieldNames: array list of fields in the index file to check
*	@param indexNameWithPath: the name index file withe the entity name
**/
function checkLengthOfFieldNames(indexFieldNames, indexNameWithPath) {
	const result = _.filter(indexFieldNames, (fieldName) => {
		snackCased = _.snakeCase(fieldName);
		return _.size(snackCased) > 63;
	});

	PrintModule.printArrayList(indexNameWithPath, result, 'Field name too long, (\'tis truncated in db if name>64 after snake casing)');
}

/**
*	Checks if the display rules in the form exist
*	@param formDef: the form to check
*	@param rules: the display rules to check against
*	@param fileName: the name of the file
**/
function checkDisplayRulesExist(formDef, rules, fileName) {
	rules = Object.keys(rules);
	let undefinedDR = getUndefinedDisplayRules(formDef, rules);
	undefinedDR = _.uniq(undefinedDR);

	const itemsToExclude = excludeModule.displayRulesToExclude(fileName);
	_.remove(undefinedDR, (rule) => _.includes(itemsToExclude, rule));

	PrintModule.printArrayList(fileName, undefinedDR, 'Undefined display rules')
}

function getUndefinedDisplayRules(formDef, rules) {
	return _.reduce(formDef, (acc, field) => {
		if (field.elements) {
			const nested = getUndefinedDisplayRules(field.elements, rules);
			acc.push.apply(acc, nested);
		}

		if (field.displayRule) {
			acc = _.concat(acc, getMissingRules(rules, field.displayRule));
		}

		return acc;
	}, []);
}

/**
*	Finds any rules missing from the ruleKeys
*	@param ruleKeys: an array containing the names of the rules
*	@param rules: the string displayRule or condition with the rules to check
*	@returns: An array containing any rule in rules missing from ruleKeys
**/
function getMissingRules(ruleKeys, rules) {
	rules = utils.splitRules(rules);
	return _.filter(rules, (rule) => !_.includes(ruleKeys, rule));
}

function getPicklistDefs(index, fileName) {
	const picklistFields = _.filter(index, (fieldDef) => {
		return fieldDef.type === 'picklist' || fieldDef.type === 'picklist[]';
	});
	return picklistFields;
}

function checkPicklistHasTypeOptions(picklistFields, fileName) {
	const attributes = ['field', 'typeOptions'];
	const noTypeOption = [];

	const result = _.reduce(picklistFields, (acc, fieldDef) => {
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
	const attributes = ['field', 'typeOptions.picklistDependencies'];

	const result = _.reduce(picklistFields, (acc, fieldDef) => {
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
	const attributes = ['field', 'typeOptions.picklistName'];

	const missingPicklistName = _.reduce(picklistIndex, (acc, fieldDef) => {
		if (!_.has(fieldDef, 'typeOptions.picklistName')) acc.push({ fieldDef, attributes });

		return acc;
	}, []);
	PrintModule.printFields(fileName, 'Picklist missing picklistName', missingPicklistName);
}

function picklistsInOptions(picklistIndex, fileName) {
	const attributes = ['field', 'typeOptions.picklistName'];
	const itemsToExclude = excludeModule.picklistsToExclude(fileName);

	const optionsKeys = Object.keys(optionsPicklist);
	const notInOptions = _.reduce(picklistIndex, (acc, fieldDef) => {
		if (!_.includes(optionsKeys, fieldDef.typeOptions.picklistName) &&
			!_.includes(itemsToExclude, fieldDef.typeOptions.picklistName)) {
			acc.push({ fieldDef, attributes });
		}

		return acc;
	}, []);

	PrintModule.printFields(fileName, 'Picklist missing from options.picklist', notInOptions, 'typeOptions', 'picklistName');
}

function picklistJSONFileExists(picklistIndex, fileName) {
	const attributes = ['field', 'typeOptions.picklistName'];
	const itemsToExclude = excludeModule.picklistsToExclude(fileName);

	const notInFiles = _.reduce(picklistIndex, (acc, fieldDef) => {
		if (!_.includes(JSONfiles, fieldDef.typeOptions.picklistName + ".json") &&
			!_.includes(itemsToExclude, fieldDef.typeOptions.picklistName)) {
			acc.push({ fieldDef, attributes, color: 'warn' });
		}

		return acc;
	}, []);

	PrintModule.printFields(fileName, 'Picklist .json file missing from data/lists', notInFiles);
}

function picklistInEn(index, fileName) {
	const attributes = ['field', 'typeOptions.picklistName'];

	const enusKeys = Object.keys(translations);
	const notInEnus = _.reduce(index, (acc, fieldDef) => {
		if (!_.includes(enusKeys, fieldDef.typeOptions.picklistName)) acc.push({ fieldDef, attributes });
		return acc;
	}, []);

	PrintModule.printFields(fileName, 'Picklist translations missing form en_US', notInEnus);
}

function picklistDependenciesMatchUp(picklistIndex, fileName) {
	const attributes = ['field', 'typeOptions.picklistDependencies'];

	const parentNotPicklist = [];
	const dependenciesMisMatch = [];

	_.forEach(picklistIndex, (fieldDef) => {
		const fieldDefClone = _.cloneDeep(fieldDef);
		if (!_.has(fieldDefClone.typeOptions, 'picklistDependencies')) return;

		const parents = fieldDefClone.typeOptions.picklistDependencies;
		if (!_.isArray(parents)) return;

		const parent = parents.pop();
		let parentFielfDef = _.filter(picklistIndex, def => def.field === parent);
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
		const files = fs.readdirSync(dataPath);
		_.forEach(files, (file) => {
			if (path.extname(file) != '.json') return;

			const picklist = require(path.join(dataPath, file));
			picklistValuesUniq(picklist, file);
			picklistHasWhiteSpace(picklist, file);
			picklistHasSameName(picklist, file);
		});
	} catch (err) {
		console.error(`Error Parsing piclists`);
		console.error(err);
		console.error(`Moving on...\n`);
	}
}

function picklistValuesUniq(picklist, fileName) {
	const uniqValues = _.uniqWith(picklist, _.isEqual);

	if (picklist.length !== uniqValues.length) {
		const result = _.reduce(picklist, (acc, item, index, arr) => {
			const containsDup = _.some(arr.slice(index + 1), (compItem) => {
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
	const whiteSpaceValues = _.reduce(picklist, (acc, item) => {
		const itemKeys = _.keys(item);
		const result = {
			offending: []
		};
		_.forEach(itemKeys, (itemKey) => {
			const attributes = [];
			const options = { fieldDef: item, attributes, color: 'default' };

			if (itemKey !== _.trim(itemKey) && (typeof itemKey === 'string')) {
				attributes.push(itemKey);
				options.keyColor = 'error';
			}

			if (typeof item[itemKey] === 'string') {
				const trimmedValue = _.trim(item[itemKey]);
				if (trimmedValue !== item[itemKey]) {
					if (!_.includes(attributes, itemKey)) attributes.push(itemKey);
					options.color = 'error';
				}
			} else if (_.isArray(item[itemKey])) {
				item[itemKey].forEach((parentValue) => {
					if (_.trim(parentValue) !== parentValue) {
						if (!_.includes(attributes, itemKey)) attributes.push(itemKey);
						options.color = 'error';
					}
				});
			}

			if (!_.isEmpty(attributes)) {
				acc.push(options);
			}
		});
		return acc;
	}, []);

	PrintModule.printFields(fileName, 'Picklist has white space', whiteSpaceValues);
}

function picklistHasSameName(picklist, fileName) {
	const arrayList = _.reduce(picklist, (acc, item) => {
		if (!_.includes(acc, item.name)) acc.push(item.name);
		return acc;
	}, []);

	if (_.size(arrayList) > 1) {
		PrintModule.printArrayList(fileName, arrayList, 'Mulitple name values');
	}
}

function checkRadioTypeOptions(radios, fileName) {
	const attributes = ['field', 'typeOptions.radios'];

	const result = _.reduce(radios, (acc, fieldDef) => {
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
	const enusKeys = Object.keys(translations);
	const radiosWithoutCaption = [];

	const result = _.reduce(radios, (acc, fieldDef) => {
		if (!_.has(fieldDef, 'typeOptions.radios') || !_.isArray(fieldDef.typeOptions.radios)) return;

		_.forEach(fieldDef.typeOptions.radios, (radioButton, index) => {
			if (!_.has(radioButton, 'caption')) {
				radiosWithoutCaption.push({ fieldDef, attributes: ['field', `typeOptions.radios.${index}.caption`], color: 'warn'})
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

function displayRulesOfValidationFields(indexFile, indexNameWithPath) {
	const mandatoryFields = indexFile.validation ? indexFile.validation['mandatory$'] : [];
	const dependentMandatory = indexFile.validation ? indexFile.validation['dependentMandatory$'] : [];
	let fieldConditionMapping;

	if (_.isEmpty(mandatoryFields) && _.isEmpty(dependentMandatory)) return;

	if (!_.isEmpty(dependentMandatory)) {
		fieldConditionMapping = getDependentMandatoryFieldMapping(dependentMandatory);
	}

	const entityFormNames = _.reduce(formFileNameMapping, (acc, formName, formFileName) => {
		if (formMapping[formName] === indexFile.entity.name) acc.push(formFileName);
		return acc;
	}, []);

	_.forEach(entityFormNames, (formName) => {
		const formPath = path.join(process.argv[2], 'config', 'form-layouts', formName);
		const form = utils.parseForm(formPath, formName);

		const result = _.reduce(form.elements, (acc, fieldDef) => {
			const isMandatoryField = _.includes(mandatoryFields, fieldDef.field);
			if (isMandatoryField && _.has(fieldDef, 'displayRule')) {
				acc.mandatoryFields.push({ fieldDef, attributes: ['field', 'displayRule'], color: 'warn' });
			}

			const isDependentMandatory = fieldConditionMapping && _.includes(Object.keys(fieldConditionMapping), fieldDef.field);
			if (isDependentMandatory && _.has(fieldDef, 'displayRule')) {
				_.forEach(fieldConditionMapping[fieldDef.field], (index) => {
					const conditions = utils.splitRules(dependentMandatory[index].condition);

					_.remove(conditions, (con) => excludeModule.displayRulesToExclude(formName).includes(con));

					const displayRules = utils.splitRules(fieldDef.displayRule);

					_.forEach(conditions, (condition) => {
						if (!_.includes(displayRules, condition)) {
							acc.dependentMandatory.push({ fieldDef, attributes: ['field', 'displayRule'], color: 'warn' });
						}
					});
					const every = _.every(conditions, condition => _.includes(displayRules, condition));
					if (!every) {
						acc.dependentMandatory.push({ fieldDef, attributes: ['field', 'displayRule'], color: 'warn' });
					}
				});
			}

			return acc;
		}, { mandatoryFields: [], dependentMandatory: [] });

		PrintModule.printFields(formName, `mandatory$ field shouldn't have displayRule`, result.mandatoryFields);
		PrintModule.printFields(formName, `dependentMandatory$ conditions don't match displayRule`, result.dependentMandatory);
	});
}

function getDependentMandatoryFieldMapping(dependentMandatory) {
	const fieldConditionMapping = {};
	_.forEach(dependentMandatory, (rule, index) => {
		_.forEach(rule.fields, (field) => {
			if (fieldConditionMapping[field]) {
				fieldConditionMapping[field].push(index)
			} else {
				fieldConditionMapping[field] = [index];
			}
		});
	});
	return fieldConditionMapping;
}

function getFieldNames(index) {
	return _.map(index, (f) => f.field );
}

function getPicklistJSONFiles() {
	return fs.readdirSync(process.argv[2] + '/data/lists');
}

function getFieldTypes(){
	const fieldTypes = require(__dirname + '/modules/fieldTypes.js');

	const fieldTypesPath = process.argv[2] + '/field-types';
	if (fs.existsSync(fieldTypesPath)) {
		const files = fs.readdirSync(fieldTypesPath);

		_.forEach(files, (file) => {
			if (fs.existsSync(fieldTypesPath + `/${file}/index.js`)) {
				const fieldIndex = require(fieldTypesPath + `/${file}/index.js`);
				fieldTypes.push(fieldIndex.name);
			}
		})
	}

	return fieldTypes
}

function getRadioDefs(index, fileName) {
	const picklistFields = _.filter(index, (fieldDef) => {
		return fieldDef.type === 'radio';
	});
	return picklistFields;
}