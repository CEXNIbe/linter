module.exports = {
	picklists: function (filename) {
		var exclude = [];
		if (filename === 'user/index.js') exclude.push('user_status');
		return exclude;
	},

	formsToExclude: [
		'case-escalation-details-form.js',
		'case-notification-details-form.js'
	]
};