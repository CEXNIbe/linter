# Linter

### Setup
- Export $LINTER_DIR in your bash profile to match your install location:
	- `export LINTER_DIR='/Users/user/path/to/linter'`
- `cd` into project & install dependecies
	- `npm install`
- Create an alias in your bash profile to run script from config_project_v5, e.g.:
	- `alias lintconfig='. /Users/nibe/git/workspace/linter/LintConfig.sh'`

### Configuration
- You can add certain things to be disabled by exporting environment variables, see --help