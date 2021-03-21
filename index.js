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
        'incbld', 'version:project:minor', 'readpkg', 'string-replace:version', 'uglify', 'chmod:mainRO', 'compress', 'rename'];
    this.buildHotfixTasks = [
        'clean:all', 'fileExists','copy:irpz', 'unzip', 'clean:prepare', 'concat', 'strip_code',
        'incbld', 'version:project:patch', 'readpkg', 'string-replace:version', 'uglify', 'chmod:mainRO', 'compress', 'rename'];
    this.buildTasks = [
        'clean:all', 'fileExists','copy:irpz', 'unzip', 'clean:prepare', 'concat', 'strip_code',
        'incbld', 'readpkg', 'string-replace:version', 'chmod:mainRO', 'compress', 'rename'];
    this.buildScriptNoDebug = ['clean:all', 'concat', 'strip_code',
        'incbld', 'readpkg', 'string-replace:version', 'string-replace:debug', 'chmod:mainRO', 'pbcopy'];
    this.buildNoConcat = [
        'clean:all', 'fileExists','copy:irpz', 'unzip', 'clean:prepare', 'copy:noConcat', 
        'string-replace:version', 'compress', 'rename'];    
    this.scriptOnlyTasks = ['clean:all', 'concat', 'strip_code',
        'incbld', 'readpkg', 'string-replace:version', 'chmod:mainRO', 'pbcopy'];

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

function saveDependenciesOrder(grunt) {
    var pkg = grunt.config.get('pkg');
    var dependencies = pkg.dependencies || {};   
    var orderList = [];
    
    for (var name in dependencies) {
        orderList.push(name);
    }

    pkg.dependenciesOrder = orderList;

    if (orderList.length) {
        _writeln(grunt, 'Saving dependencies order to package.json');
        grunt.file.write('package.json', JSON.stringify(pkg, null, 2));
    }
}

function buildLocalScriptList(grunt, mainJS, jsonPath) {
    var scriptList = getPackageValue(grunt, 'projectScripts', jsonPath ? (jsonPath + '/package.json') : undefined);

    if (!scriptList) {
        _warn(grunt, 'No local scripts in package.json');
        return [];
    }

    var result  = [];

    var tempMainJS = 'temp/scripts/' + mainJS;

    scriptList.forEach(function(item){
        var path = jsonPath ? (jsonPath + '/' + item) : item;
        if (!grunt.file.exists(path)) {
            // Завершаем grunt-скрипт с ошибкой
            _warn(grunt, 'Script not found: ' + path);
        }   

        result.push(path);
        _writeln(grunt, 'Adding: ' + path);
    });
    result.unshift(tempMainJS);

    return result;
}

function buildModuleList(grunt, jsonPath) {
    // Создаем массив модулей, прописанных в dependencies

    var moduleScriptList = {};
    moduleScriptList.indexJS = [];
    moduleScriptList.modules = []; 

    var dependencies = getPackageValue(grunt, 'dependencies', jsonPath);
    var orderedList = getPackageValue(grunt, 'dependenciesOrder', jsonPath);

    var list = [];

    // Compare dependencies and dependenciesOrder
    for (var n in dependencies) { list.push(n); }
    if (orderedList) {
        if (orderedList.length !=  list.length) {
            _warn(grunt, 'dependencies and dependenciesOrder count mismatch: ');   
        }
        orderedList.forEach( function(name) {
            if (!dependencies[name]) {
                _warn(grunt, 'dependencies and dependenciesOrder mismatch: ' + name);
            }
        });
        list = orderedList;
    }

    for (var i = 0; i < list.length; i ++) {
        var name = list[i];

        var moduleJsonPath = 'node_modules/' + name + '/package.json';

        var moduleJsonPathExist = grunt.file.exists(moduleJsonPath);
        if (!moduleJsonPathExist) {
            // Завершаем grunt-cкрипт с ошибкой
            _warn(grunt, 'No package.json in the module: ' + moduleJsonPath);
        }

        var moduleJson = moduleJsonPathExist ? grunt.file.readJSON(moduleJsonPath) : null;
        var moduleVersion  = moduleJson ? moduleJson.version : null;
        var indexJS = moduleJson ? moduleJson.main || 'index.js' : 'index.js';
        indexJS = (indexJS == '') ? 'index.js' : indexJS;

        var modulePath = 'node_modules/' + name + '/' + indexJS;

        // Если indexJS == 'gruntfile.js', то это родительский проект, который обрабатывается особенным образом
        if (indexJS != 'gruntfile.js') {
            var modulePathExist = grunt.file.exists(modulePath);
            if (!modulePathExist) {
                // Завершаем grunt-cкрипт с ошибкой
                _warn(grunt, 'Script not found: ' + modulePath);
            }
            moduleScriptList.indexJS.push(modulePath);
        } else {
            // Это родительский модуль
            moduleScriptList.parentJson = moduleJsonPath;
            moduleScriptList.parent = 'node_modules/' + name;
        }

        var module = {};
        module.json = moduleJsonPath;
        module.name = name;
        moduleScriptList.modules.push(module);
        
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
    grunt.registerTask('readpkg', 'Read in the package.json file', function() {
        grunt.config.set('pkg', grunt.file.readJSON('./package.json'));
    });

    grunt.registerTask('incbld', 'Increment build number', function() {
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
    grunt.registerTask('build:hotfix', this.buildHotfixTasks);
    grunt.registerTask('build:script', this.scriptOnlyTasks);
    grunt.registerTask('build:noConcat', this.buildNoConcat);
    grunt.registerTask('build:scriptNoDebug', this.buildScriptNoDebug);
    grunt.registerTask('build', this.buildTasks);

    grunt.registerTask('build_script', function(){
        _fatal(grunt, 'Task build_script deprecated - use build:script');
    });
    grunt.registerTask('build_release', function(){
        _fatal(grunt, 'Task build_release deprecated - use build:release');
    });

    grunt.registerTask('build:from_temp', ['compress', 'rename']);
    grunt.registerTask('clear', ['clean:all']);

    grunt.registerTask('save-dep-order', 'Save dependencies order', function(){
        saveDependenciesOrder(grunt);
    });

    grunt.registerTask('pbcopy', 'copy main.js to clipboard', function(){
        // This function support OSX only!
        // TODO: Add check for OSX

        function pbcopy(data) {
            return new Promise(function(resolve, reject) {
                const proc = require('child_process').spawn('pbcopy');
                proc.on('error', function(err) {
                    reject(err);
                });
                proc.on('close', function() {
                    resolve();
                });
                proc.stdin.write(data);
                proc.stdin.end();
            });
        }

        var done = this.async();

        var fs = require('fs');
        fs.open('temp/scripts/main.js', 'r', function(err, fileToRead){
            if (!err){
                fs.readFile(fileToRead, {encoding: 'utf-8'}, function(err,data){
                    if (!err){
                        pbcopy(data)
                            .then(function() {
                                _writeln(grunt, 'main.js copied to clipboard');
                                done();
                            });
                    } else{
                        _warn(grunt, 'Failed to copy main.js to clipboard');
                        done();
                    }
                
                });
            }else{
                _warn(grunt, 'Failed to copy main.js to clipboard');
                done();
            }
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

    var mainJS = pkg['iridium-main'] || 'main.js';


    var moduleScriptList = buildModuleList(grunt);
    var localScriptList = buildLocalScriptList(grunt, mainJS);

    var hasParent = moduleScriptList.parent ? true : false;

    var parentLocalScriptList = null;
    var parentModuleScriptList = null;
    var parentMainJS = 'main.js';

    if (hasParent) {
        parentModuleScriptList =  buildModuleList(grunt, moduleScriptList.parentJson);
        parentLocalScriptList = buildLocalScriptList(grunt, parentMainJS, moduleScriptList.parent);
    }

    var resultName = pkg.build ? 
        'build/' + this.projectName + '<%= pkg.version %>-<%= pkg.build %>.' + this.projectExtension :
        'build/' + this.projectName + '<%= pkg.version %>.' + this.projectExtension;


    var initJson = {
        pkg: pkg,
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
                src: ['temp/scripts/' + mainJS]
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
                src : ['temp/scripts/' + mainJS],
                dest : 'temp/scripts/' + mainJS
            }
        },
        fileExists: {
            project: ['project/' + this.projectName + '.' + this.projectExtension]
        },

        copy: {
            irpz: {
                expand: true,
                cwd: 'project/',
                src: [this.projectName + '.' + this.projectExtension],
                dest: 'temp'
            },
            noConcat: {
                expand: true,
                flatten: true,
                dest: 'temp/scripts'
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
                src: [ 'temp/*.' + this.projectExtension, 'temp/scripts/' + mainJS]
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

    };


    var concatOpt = {
        options: {
            separator: ';'
        }
    };

    var strReplaceOpt = {
        debug: {
            src : ['temp/scripts/*.js'],
            dest : 'temp/scripts/',
            options: {
                replacements: [{
                    pattern: /_Debug\([^;]+;/ig,
                    replacement: ''
                }]
            }
        },
        version: {
            src : ['temp/scripts/*.js'],
            dest : 'temp/scripts/',
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
    };

    if (parentModuleScriptList && parentModuleScriptList.indexJS && parentModuleScriptList.indexJS.length) {
        concatOpt.list1 = {};
        concatOpt.list1.src = parentModuleScriptList.indexJS;
        concatOpt.list1.dest = 'temp/scripts/' + parentMainJS;
    }
    if (parentLocalScriptList && parentLocalScriptList.length) {
        concatOpt.list2 = {};
        concatOpt.list2.src = parentLocalScriptList;
        concatOpt.list2.dest = 'temp/scripts/' + parentMainJS;           
    }

    if (moduleScriptList && moduleScriptList.indexJS && moduleScriptList.indexJS.length) {
        concatOpt.list3 = {};
        concatOpt.list3.src = moduleScriptList.indexJS;
        concatOpt.list3.dest = 'temp/scripts/' + mainJS;
    }

    if (localScriptList && localScriptList.length) {
        concatOpt.list4 = {};
        concatOpt.list4.src = localScriptList;
        concatOpt.list4.dest = 'temp/scripts/' + mainJS;           
    }


    var copyList1 = concatOpt.list1 ? concatOpt.list1.src : [];
    var copyList2 = concatOpt.list2 ? concatOpt.list2.src : [];
    var copyList3 = concatOpt.list3 ? concatOpt.list3.src : [];
    var copyList4 = concatOpt.list4 ? concatOpt.list4.src : [];


    initJson.copy.noConcat.src = copyList1.concat(copyList2).concat(copyList3).concat(copyList4);
    initJson.concat = concatOpt;

    initJson['string-replace'] = strReplaceOpt;

    grunt.config.init(initJson);
};

module.exports = IridiumGrunt;
