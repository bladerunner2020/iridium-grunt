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
        'update-tags:add', 'clean:all', 'fileExists','copy:irpz', 'unzip', 'clean:prepare', 'concat', 'strip_code',
        'incbld', 'readpkg', 'string-replace', 'uglify', 'chmod:mainRO', 'compress', 'rename'];
    this.buildTasks = [
        'update-tags:add', 'clean:all', 'fileExists','copy:irpz', 'unzip', 'clean:prepare', 'concat', 'strip_code',
        'incbld', 'readpkg', 'string-replace', 'chmod:mainRO', 'compress', 'rename'];
    this.scriptOnlyTasks = ['clean:all', 'copy:irpz', 'unzip', 'clean:prepare', 'concat', 'strip_code',
        'incbld', 'readpkg', 'string-replace', 'chmod:mainRO'];    


    _writeln(grunt, 'Starting IridiumGrunt...');

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
function updateVersionTags(grunt, force) {
    var options = grunt.config.get('update-tags');
    var moduleList = options.list;
    var pkg = grunt.config.get('pkg');
    var dependencies = pkg.dependencies;

    var updated = false;
    for (var i = 0; i < moduleList.indexJS.length; i++) {
        var packagePath = moduleList.packageJSON[i];
        var name  = moduleList.names[i];
        var version = getPackageValue(grunt, 'version', packagePath);
        var dep = dependencies[name];
        var oldVersion  = dep.replace(/.+#v/, '');
        if (oldVersion == dep) { oldVersion = 'none'; }
        dep = dependencies[name].replace(/#v.+$/, '');

        if (oldVersion != version || force) {
            _writeln(grunt, 'Updating: ' + dep + ' - ' + oldVersion + ' =>' + version);
            dep += '#v' + version;

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
function removeVersionTags(grunt) {
    var options = grunt.config.get('update-tags');
    var moduleList = options.list;
    var pkg = grunt.config.get('pkg');
    var dependencies = pkg.dependencies;

    var updated = false;
    for (var i = 0; i < moduleList.indexJS.length; i++) {
        var name  = moduleList.names[i];
        var dep = dependencies[name];
        var oldVersion  = dep.replace(/.+#v/, '');
        dep = dependencies[name].replace(/#v.+$/, '');

        if (dependencies[name] != dep) {
            _writeln(grunt, 'Updating: ' + dep + ' - ' + oldVersion);
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
        var modulePath = 'node_modules/' + obj + '/index.js';
        var moduleJsonPath = 'node_modules/' + obj + '/package.json';

        var modulePathExist = grunt.file.exists(modulePath);
        if (!modulePathExist) {
            // Завершаем grunt-cкрипт с ошибкой
            _warn(grunt, 'Script not found: ' + modulePath);
        }

        var moduleJsonPathExist = grunt.file.exists(moduleJsonPath);
        if (!moduleJsonPathExist) {
            // Завершаем grunt-cкрипт с ошибкой
            _warn(grunt, 'No package.json in the module: ' + moduleJsonPath);
        }

        var moduleJson = moduleJsonPathExist ? grunt.file.readJSON(moduleJsonPath) : null;
        var moduleVersion  = moduleJson ? moduleJson.version : null;

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

    grunt.registerTask('build_release', this.buildReleaseTasks);
    grunt.registerTask('build_script', this.scriptOnlyTasks);
    grunt.registerTask('build', this.buildTasks);

    grunt.registerTask('build_from_temp', ['compress', 'rename']);
    grunt.registerTask('clear', ['clean:all']);

    grunt.registerMultiTask('update-tags', 'Update dependencies', function() {
        // This task add or remove version tags to all dependencies in package.json

        switch (this.target) {
            case 'add':
                updateVersionTags(grunt);
                break;
            case 'force':
                updateVersionTags(grunt, true);
                break;    
            case 'remove':
                removeVersionTags(grunt);
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
