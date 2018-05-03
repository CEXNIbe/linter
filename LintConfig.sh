workingDir=$(pwd)
projectDir=$LINTER_DIR


if [ -z "$LINTER_DIR" ]; then
	echo '---------------------------------------------------'
	echo 'Environment variable LINTER_DIR not provided'
	echo 'Please export LINTER_DIR=<path_of_wireframe_linter>'
	echo '---------------------------------------------------'
else
	mkdir $projectDir/temp_files
	node $projectDir/index.js $workingDir
	rm -rf $projectDir/temp_files
fi