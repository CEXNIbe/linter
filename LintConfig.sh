workingDir=$(pwd)
projectDir=$LINTER_DIR

nodeVersion=$(node -v)
endIndex=$((`expr index "$nodeVersion" .` - 1))
nodeVersion=$(echo $nodeVersion | cut -c2-$endIndex)

if [ -z "$LINTER_DIR" ]; then
	echo '---------------------------------------------------'
	echo 'Environment variable LINTER_DIR not provided'
	echo 'Please export LINTER_DIR=<path/to/linter>'
	echo '---------------------------------------------------'
elif [[ $nodeVersion -lt 6 ]]; then
	echo '---------------------------------------------------'
	echo 'Unsupported node version' $(node -v)
	echo '---------------------------------------------------'
elif [ $# -gt 0 ]; then
	if [[ ($1 = "--help"  || $1 = "-h") ]]; then
		echo "
Environment variables to exclude item from being checked

	- LINTER_DIR_DISPLAY_RULES_TO_EXCLUDE: comma seperated list of display rules to ignore

	- LINTER_DIR_FORMS_TO_EXCLUDE: comma seperated list of forms to exclude

	- LINTER_DIR_FIELDS_TO_EXCLUDE: comma seperated list of fields to exclude
		"
	else
		echo 'unreconized argument "'$1'"'
		echo 'use --help or -h to see more info'
	fi
else
	node $projectDir/config.js $workingDir
	mkdir $projectDir/temp_files
	node $projectDir/index.js $workingDir
	rm -rf $projectDir/temp_files
fi