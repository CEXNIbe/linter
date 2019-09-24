const PLATFORM_VERSIONS = {
	FIVE: 'FIVE',
	FOUR: 'FOUR',
	unknown: 'unknown'
};

function getPlatformVersion() {
	const packageFile = require(`${process.argv[2]}/package.json`);
	let isightVersion = packageFile.dependencies.isight;
	// Taking a shortcut for now
	if (!isightVersion) return PLATFORM_VERSIONS.FOUR;
	const tagIndex = isightVersion.indexOf('#') + 1;
	const tag = isightVersion.slice(tagIndex);
	if (tag.startsWith('v5')) return PLATFORM_VERSIONS.FIVE;
	return PLATFORM_VERSIONS.unknown;
}

const platformVersion = getPlatformVersion();

module.exports = {
	PLATFORM_VERSIONS,
	platformVersion,
	platformVersionIsFive: platformVersion === PLATFORM_VERSIONS.FIVE,
	platformVersionIsFour: platformVersion === PLATFORM_VERSIONS.FOUR
}