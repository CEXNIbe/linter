workingDir=$(pwd)
projectDir="/Users/nibe/git/workspace/wireframe_linter"
lintDir=$projectDir"/standard/field_types.json"
node $projectDir/IndexFields.js $workingDir $lintDir