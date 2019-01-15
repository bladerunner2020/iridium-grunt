/* eslint-disable no-console */

function _writeln (grunt, message ) {
    grunt.option('useConsole') ? console.log(message) : grunt.log.writeln(message);
}

// eslint-disable-next-line no-unused-vars
function _fatal (grunt, message ) {
    grunt.option('useConsole') ? console.log(message) : grunt.fail.fatal(message);
}

function _warn (grunt, message ) {
    grunt.option('useConsole') ? console.log(message) : grunt.fail.warn(message);
}


function IridiumGrunt(grunt) {
    this.grunt = grunt;

    this.buildReleaseTasks = [
        'clean:all', 'fileExists','copy:irpz', 'unzip', 'clean:prepare', 'concat', 'strip_code',
        'incbld', 'readpkg', 'update-tags:add', 'string-replace', 'uglify', 'chmod:mainRO', 'compress', 'rename'];
    this.buildTasks = [
        'clean:all', 'fileExists','copy:irpz', 'unzip', 'clean:prepare', 'concat', 'strip_code',
        'incbld', 'readpkg', 'update-tags:add', 'string-replace', 'chmod:mainRO', 'compress', 'rename'];
    this.scriptOnlyTasks = ['clean:all', 'copy:irpz', 'unzip', 'clean:prepare', 'concat', 'strip_code',
        'incbld', 'readpkg', 'string-replace', 'chmod:mainRO'];    


    _writeln(grunt, 'Starting IridiumGrunt...');

    var path = __dirname + '/package.json';
    var pkg = grunt.file.readJSON(path );
    if (pkg) {
        var iridiumGruntVersion = pkg.version;
        _writeln(grunt, 'IridiumGrunt version: ' + iridiumGruntVersion);
    }

    pkg = grunt.config.get('pkg') || grunt.file.readJSON('package.json');

    var projectFiles = grunt.file.expand(['project/*.irpz', 'project/*.sirpz']);
    if (projectFiles.length > 1) {
        _warn(grunt, 'Folder "project" has more than one file.');
    }

    var filename = projectFiles.length ? require('path').parse(projectFiles[0]) : null;

    this.projectName = filename ? filename.name : '';
    this.projectExtension = filename ? filename.ext.replace('.', '') : '';
    if (this.projectName) {
        _writeln(grunt, 'Project name: ' + this.projectName + '.' + this.projectExtension);
    } else {
        _writeln(grunt, 'No project found in "project" folder.');
    }
    
    if (pkg) {
        var version = pkg.version;
        var build = pkg.build;
        _writeln(grunt, 'Version (package.json): ' + version + (build? ('-' + build) : ''));
    } else {
        _warn(grunt, 'Cannot read package.json');
    }

    this.initGruntConfig();
    this.loadModules();
    this.registerTasks();
}

function getPackageValue(grunt, value, fileName) {
    var package_json = fileName ? grunt.file.readJSON(fileName) : grunt.config.get('pkg') || grunt.file.readJSON('package.json');
    return package_json? package_json[value] : null;
}

/**
 * Add tags with version info to dependencies (info is taken from installed modules (package.json files in node_modules))
 * @param {*} grunt 
 * @param {boolean} force - if true updates dependencies and restore their original order
 */
function updateGitTags(grunt, force) {
    var options = grunt.config.get('update-tags');
    var moduleList = options.list;
    var pkg = grunt.config.get('pkg');
    var dependencies = pkg.dependencies;

    var updated = false;
    for (var i = 0; i < moduleList.indexJS.length; i++) {
        var packagePath = moduleList.packageJSON[i];
        var name  = moduleList.names[i];
        var installedCommitUrl = getPackageValue(grunt, '_resolved', packagePath);  // link to installled commit
        var dep = dependencies[name];

        var installedCommitIsh = installedCommitUrl.replace(/.+#/, '');                  // extact commit-ish
        var oldCommitIsh  = dep.replace(/.+#/, '');                                 // extract commit-ish from dependency
        if (oldCommitIsh == dep) { oldCommitIsh = 'none'; }
        dep = dependencies[name].replace(/#.+$/, '');                               // remove commit-ish

        if (oldCommitIsh != installedCommitIsh || force) {
            _writeln(grunt, 'Updating: ' + dep + ': ' + oldCommitIsh + ' => ' + installedCommitIsh);
            dep = installedCommitUrl;

            // This is necessary to restore original order of dependencies in package.json
            if (force) {
                delete dependencies[name];
            }

            dependencies[name] = dep;
            updated = true;
        }
    }

    if (updated) {
        _writeln(grunt, 'Updating package.json...');
        grunt.file.write('package.json', JSON.stringify(pkg, null, 2));
    }
}

/**
 * Remove tags with version info from dependencies
 * @param {*} grunt 
 */
function removeGitTags(grunt) {
    var options = grunt.config.get('update-tags');
    var moduleList = options.list;
    var pkg = grunt.config.get('pkg');
    var dependencies = pkg.dependencies;

    var updated = false;
    for (var i = 0; i < moduleList.indexJS.length; i++) {
        var name  = moduleList.names[i];
        var dep = dependencies[name];
        var commitIsh  = dep.replace(/.+#/, '');
        dep = dependencies[name].replace(/#.+$/, '');

        if (dependencies[name] != dep) {
            _writeln(grunt, 'Updating: ' + dep + ': removed ' + commitIsh);
            dependencies[name] = dep;
            updated = true;
        }
    }

    if (updated) {
        _writeln(grunt, 'Updating package.json...');
        grunt.file.write('package.json', JSON.stringify(pkg, null, 2));
    }

}

function buildLocalScriptList(grunt) {
    var scriptList = getPackageValue(grunt, 'projectScripts');

    if (!scriptList) {
        _warn(grunt, 'No local scripts in package.json');
        return [];
    }

    scriptList.unshift('temp/scripts/main.js');

    scriptList.forEach(function(item){

        var path = item;
        if (path != 'temp/scripts/main.js' && !grunt.file.exists(path)) {
            // Завершаем grunt-скрипт с ошибкой
            _warn(grunt, 'Script not found: ' + path);
            return; // Necessary if used with useConsole flag
        }   

        _writeln(grunt, 'Adding: ' + path);
    });

    return scriptList;
}

function buildModuleList(grunt) {
    // Создаем массив модулей, прописанных в dependencies
    // Предполагается, что модуль состоит из одного файла index.js

    var moduleScriptList = {};
    moduleScriptList.indexJS = [];
    moduleScriptList.packageJSON = []; 
    moduleScriptList.names = [];

    var dependencies = getPackageValue(grunt, 'dependencies');

    for (var obj in dependencies){
        var moduleJsonPath = 'node_modules/' + obj + '/package.json';

        var moduleJsonPathExist = grunt.file.exists(moduleJsonPath);
        if (!moduleJsonPathExist) {
            // Завершаем grunt-cкрипт с ошибкой
            _warn(grunt, 'No package.json in the module: ' + moduleJsonPath);
        }

        var moduleJson = moduleJsonPathExist ? grunt.file.readJSON(moduleJsonPath) : null;
        var moduleVersion  = moduleJson ? moduleJson.version : null;
        var indexJS = moduleJson ? moduleJson.main || 'index.js' : 'index.js';
        indexJS = (indexJS == '') ? 'index.js' : indexJS;

        var modulePath = 'node_modules/' + obj + '/' + indexJS;

        var modulePathExist = grunt.file.exists(modulePath);
        if (!modulePathExist) {
            // Завершаем grunt-cкрипт с ошибкой
            _warn(grunt, 'Script not found: ' + modulePath);
        }

        moduleScriptList.indexJS.push(modulePath);
        moduleScriptList.packageJSON.push(moduleJsonPath);
        moduleScriptList.names.push(obj);
        
        _writeln(grunt, 'Script: ' + modulePath + '  (v.' + moduleVersion +')');
    }

    return moduleScriptList;
}

IridiumGrunt.prototype.setTasks = function(name, tasks) {
    var currentTasks = this[name];

    if (!currentTasks) {
        _warn(this.grunt, 'Wrong name: ' + name);
    }

    this[name] = tasks;

    return this;
};

IridiumGrunt.prototype.registerTasks = function() {
    var grunt = this.grunt;
    grunt.registerMultiTask('readpkg', 'Read in the package.json file', function() {
        grunt.config.set('pkg', grunt.file.readJSON('./package.json'));
    });

    grunt.registerMultiTask('incbld', 'Increment build number', function() {
        var pkg = grunt.config.get('pkg');
        if (pkg.build == undefined) {
            _writeln(grunt, 'No build number in package.json');  
            return;
        }
        var buildNumber = parseInt(pkg.build);
        if (isNaN(buildNumber)) {
            _writeln(grunt, 'Wrong build number in package.json (cannot increment): ' + pkg.build);  
            return;
        }
        pkg.build = (buildNumber + 1).toString();
        grunt.file.write('package.json', JSON.stringify(pkg, null, 2));
        _writeln(grunt, 'Build number increased: ' + buildNumber + ' => ' + pkg.build);  
    });

    grunt.registerTask('build:release', this.buildReleaseTasks);
    grunt.registerTask('build:script', this.scriptOnlyTasks);
    grunt.registerTask('build', this.buildTasks);


    grunt.registerTask('build_script', function(){
        _fatal(grunt, 'Task build_script deprecated - use build:script');
    });
    grunt.registerTask('build_release', function(){
        _fatal(grunt, 'Task build_release deprecated - use build:release');
    });


    grunt.registerTask('build:from_temp', ['compress', 'rename']);
    grunt.registerTask('clear', ['clean:all']);




    grunt.registerMultiTask('update-tags', 'Update dependencies', function() {
        // This task add or remove version tags to all dependencies in package.json

        switch (this.target) {
            case 'add':
                updateGitTags(grunt);
                break;
            case 'force':
                updateGitTags(grunt, true);
                break;    
            case 'remove':
                removeGitTags(grunt);
                break;
            default:
                _fatal(grunt, 'Unexpected target for "update-tags" (expected "add" or "remove"');        
        }
    });


    // Install NPM Updates
    grunt.registerTask('update', 'Update package.json and update npm modules', function() {
        _writeln(grunt, 'If you get an error here, run "npm install -g npm-check-updates".');
        
        grunt.task.run('update-tags:remove');
        grunt.task.run('npm-update-ver');
        grunt.task.run('npm-update');
        grunt.task.run('update-tags:force');
    });
  

    // Write new versions to packages.json
    grunt.registerTask('npm-update-ver', 'Write new versions to package.json', function() {
        var done = this.async();

        _writeln(grunt, 'Checking for npm modules updates ...');

        grunt.util.spawn({
            cmd: 'ncu',
            args: ['-u'],
            opts: {
                stdio: 'inherit',
            }
        }, function () {
            _writeln(grunt, 'New versions were written to "package.json".');
            done();
        });
    });

    // Update npm modules
    grunt.registerTask('npm-update', 'Update npm modules', function() {
        var done = this.async();

        _writeln(grunt, 'Installing npm modules updates ...');

        grunt.util.spawn({
            cmd: 'npm',
            args: ['update','--loglevel','warn'],
            opts: {
                stdio: 'inherit',
            }
        }, function () {
            _writeln(grunt, 'NPM modules were updated.');
            done();
        });
    });
};

IridiumGrunt.prototype.loadModules = function() {
    var grunt = this.grunt;
    grunt.loadNpmTasks('grunt-contrib-rename');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-zip');
    grunt.loadNpmTasks('grunt-file-exists');
    grunt.loadNpmTasks('grunt-version');
    grunt.loadNpmTasks('grunt-strip-code');
    grunt.loadNpmTasks('grunt-string-replace');
    grunt.loadNpmTasks('grunt-chmod');
};

IridiumGrunt.prototype.initGruntConfig = function() {
    var grunt = this.grunt;
    var pkg = grunt.file.readJSON('package.json');

    var moduleScriptList = buildModuleList(grunt);
    var localScriptList = buildLocalScriptList(grunt);

    var resultName = pkg.build ? 
        'build/' + this.projectName + '<%= pkg.version %>-<%= pkg.build %>.' + this.projectExtension :
        'build/' + this.projectName + '<%= pkg.version %>.' + this.projectExtension;

    grunt.config.init({
        pkg: pkg,
        readpkg: {
            dummy: {}
        },
        incbld: {
            dummy: {}
        },
        'update-tags': {
            list: moduleScriptList,
            remove : {},
            force: {},
            add : {}
        },
        version: {
            project: {
                src: ['package.json']
            }
        },
        chmod: {
            mainRO : {
                options: {
                    mode : '444'
                },
                src: ['temp/scripts/main.js']
            }
        },

        strip_code: {
            options: {
                blocks: [
                    {
                        start_block: '/* begin-strip-block */',
                        end_block: '/* end-strip-block */'
                    }
                ]
            },
            your_target: {
                src: 'temp/scripts/*.js'
            }
        },
        uglify: {
            options: {
                mangle: true,
                output : {
                    max_line_len: 160
                }
            },
            my_target: {
                files: {
                    'temp/scripts/main.js': ['temp/scripts/main.js']
                }
            }
        },
        'string-replace': {
            version: {
                files: {
                    'temp/scripts/main.js': 'temp/scripts/main.js'
                },
                options: {
                    replacements: [
                        {
                            pattern: /{{ VERSION }}/g,
                            replacement: '<%= pkg.version %>'
                        },
                        {
                            pattern: /{{ BUILD_VERSION }}/g,
                            replacement: pkg.build ? '<%= pkg.build %>' : 'n/a'
                        }
                    ]
                }
            }
        },
        fileExists: {
            project: ['project/' + this.projectName + '.' + this.projectExtension]
        },
        concat: {
            options: {
                separator: ';'
            },
            lib: {
                src: moduleScriptList.indexJS,
                dest: 'temp/scripts/main.js'
            },
            script: {
                src: localScriptList,
                dest: 'temp/scripts/main.js'
            }
        },

        copy: {
            irpz: {
                expand :true,
                cwd: 'project/',
                src: [this.projectName + '.' + this.projectExtension],
                dest: 'temp'
            }
        },
        rename: {
            toIrpz: {
                src: 'build/myproject.zip',
                dest: resultName
            }
        },
        clean: {
            all: {
                src: [ 'temp', 'build/*' + this.projectExtension ]
            },
            prepare:{
                src: [ 'temp/*.' + this.projectExtension, 'temp/scripts/main.js']
            }
        },

        compress: {
            build: {
                options: {
                    archive: 'build/myproject.zip'
                },
                files: [
                    {expand: true, cwd: 'temp/', src: ['**'], dest: '/'} // makes all src relative to cwd
                ]
            }
        },

        unzip: {
            'main': {
                // Note: If you provide multiple src files, they will all be extracted to the same folder.
                // This is not well-tested behavior so use at your own risk.
                src: 'temp/' + this.projectName + '.' + this.projectExtension,
                dest: 'temp/'
            }
        }

    });
};

module.exports = IridiumGrunt;
