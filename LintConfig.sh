workingDir=$(pwd)
projectDir="/Users/nibe/git/wireframe_linter"

mkdir $projectDir/temp_files
node $projectDir/index.js $workingDir $projectDir
rm -rf $projectDir/temp_files