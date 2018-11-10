/**
	This module defines files/items to exclude from error checking
**/


module.exports = {
	picklists: function (filename) {
		var exclude = [];
		if (filename === 'user/index.js') exclude.push('user_status');
		return exclude;
	},

	displayRulesToExclude: function (filename) {
		var exclude = [];

		if (filename === 'todo-details-form.js') {
			exclude.push('isNotNew');
		} else if (filename === 'file-details-form.js') {
			exclude.push('isNotNew');
		} else if (filename === 'note-details-form.js') {
			exclude.push('isNotNew');
		}

		return exclude;
	},

	formsToExclude: [
		'case-escalation-details-form.js',
		'case-notification-details-form.js'
	],

	validationFieldsToExclude: function (filename) {
		var exclude = [];

		if (filename === 'user/validation.js') {
			exclude.push('oldPassword', 'confirmedPassword');
		} else if (filename === 'todo/validation.js') {
			exclude.push('other');
		}

		return exclude;
	},

	validationConditionsToExclude: function (filename) {
		var exclude = [];

		if (filename === 'todo/validation.js') {
			exclude.push('isTodoTypeOther')
		}

		return exclude;
	}
};