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
        'incbld', 'readpkg', 'string-replace', 'uglify', 'chmod:mainRO', 'compress', 'rename'];
    this.buildTasks = [
        'clean:all', 'fileExists','copy:irpz', 'unzip', 'clean:prepare', 'concat', 'strip_code',
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
    var package_json = grunt.config.get('pkg') || grunt.file.readJSON(fileName || 'package.json');
    return package_json? package_json[value] : null;
}

function buildLocalScriptList(grunt) {
    var scriptList = getPackageValue(grunt, 'projectScripts');

    if (!scriptList) {
        _warn(grunt, 'No local sripts in package.json');
        return [];
    }

    scriptList.unshift('temp/scripts/main.js');

    scriptList.forEach(function(item){

        var path = item;
        if (path != 'temp/scripts/main.js' && !grunt.file.exists(path)) {
            // Завершаем grunt-cкрипт с ошибкой
            _warn(grunt, 'Script not found: ' + path);
            return; // Necessary if used with useConsole flag
        }   

        _writeln(grunt, 'Adding: ' + path);
    });

    return scriptList;
}

function buildModuleScriptList(grunt) {
    // Создаем массив модулей, прописанных в dependencies
    // Предполагается, что модуль состоит из одного файла index.js

    var moduleScriptList = [];

    var dependencies = getPackageValue(grunt, 'dependencies');

    for (var obj in dependencies){
        var modulePath = 'node_modules/' + obj + '/index.js';
        var moduleJsonPath = 'node_modules/' + obj + '/package.json';
        if (!grunt.file.exists(modulePath)) {
            // Завершаем grunt-cкрипт с ошибкой
            _warn(grunt, 'Script not found: ' + modulePath);
            continue; // Necessary if used with useConsole flag
        }

        if (!grunt.file.exists(moduleJsonPath)) {
            // Завершаем grunt-cкрипт с ошибкой
            _warn(grunt, 'No package.json in the module: ' + moduleJsonPath);
            continue; // Necessary if used with useConsole flag
        }

        var moduleJson = grunt.file.readJSON(moduleJsonPath);
        var moduleVersion  = moduleJson ? moduleJson.version : null;
        moduleScriptList.push(modulePath);
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
        var buildNumber = pkg.build;
        try {
            buildNumber = parseInt(buildNumber);
            pkg.build = buildNumber + 1;
            grunt.file.write('package.json', JSON.stringify(pkg, null, 2));
            _writeln(grunt, 'Build bumber increased: ' + buildNumber + ' => ' + pkg.build);  
        } catch(e) {
            _writeln(grunt, 'No build number in package.json');  
        }
    });

    grunt.registerTask('build_release', this.buildReleaseTasks);
    grunt.registerTask('build_script', this.scriptOnlyTasks);
    grunt.registerTask('build', this.buildTasks);

    grunt.registerTask('build_from_temp', ['compress', 'rename']);
    grunt.registerTask('clear', ['clean:all']);
};

IridiumGrunt.prototype.loadModules = function() {
    var grunt = this.grunt;
    grunt.loadNpmTasks('grunt-rename');
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

IridiumGrunt.prototype.initGruntConfig = function(=) {
    var grunt = this.grunt;

    var pkg = grunt.file.readJSON('package.json');
    grunt.config.init({
        pkg: pkg,
        readpkg: {
            general: {}
        },
        incbld: {
            dummy: {}
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
                src: buildModuleScriptList(grunt),
                dest: 'temp/scripts/main.js'
            },
            script: {
                src: buildLocalScriptList(grunt),
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
                dest: 'build/' + this.projectName + '<%= pkg.version %>.' + this.projectExtension
            }
        },
        clean: {
            all: {
                src: [ 'temp', 'build/*' + this.projectExtension ]
            },
            prepare:{
                src: [ 'temp/*' + this.projectExtension, 'temp/scripts/*.js']
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
                src: 'temp/' + this.projectName + '.' + this.projectExtensiong,
                dest: 'temp/'
            }
        }

    });
};


module.exports = IridiumGrunt;
