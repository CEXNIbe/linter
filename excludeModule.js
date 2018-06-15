module.exports = {
	picklists: function (filename) {
		var exclude = [];
		if (filename === 'user/index.js') exclude.push('user_status');
		return exclude;
	},

	displayRulesToExclude: function (filename) {
		var exclude = [];
		if (filename === 'todo-details-form.js') exclude.push('isNotNew');
		return exclude;
	},

	formsToExclude: [
		'case-escalation-details-form.js',
		'case-notification-details-form.js'
	],

	validationFieldsToExclude: function (filename) {
		var exclude = [];
		if (filename === 'user/validation.js') exclude.push('oldPassword', 'confirmedPassword');
		return exclude
	}
};