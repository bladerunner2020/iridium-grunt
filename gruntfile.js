module.exports = function(grunt){
    var project_name = grunt.option('project');


    function getPackageValue(value, fileName) {
        var package_json = grunt.config.get('pkg') || grunt.file.readJSON(fileName || 'package.json');
        return package_json? package_json[value] : null
    }

    function buildScriptList() {
        var scriptList = getPackageValue('projectScripts');
        if (scriptList) {
            scriptList.unshift("temp/scripts/main.js");
            console.log('Local scripts: ' + scriptList);
        } else {
            console.log('WARNING: Local scripts not found in project.json!');
            scriptList = ["temp/scripts/main.js"];

        }

        return scriptList;
    }


    // General code


    if (!project_name) grunt.fail.fatal('No project.]');

    var project_extension = project_name.replace(/^.*?\.([a-zA-Z0-9]+)$/, "$1");
    var project_name_no_ext = project_name.replace(/\.[^/.]+$/, "");

    grunt.log.writeln('Building project: ' + project_name);

    var moduleScriptList = []; // Список глобальных скриптов проекта (модулей), указанных в dependencies


    grunt.config.init({
        pkg: grunt.file.readJSON("package.json"),
        readpkg: {
            general : {}

        },
        version: {
            project: {
                src: ['package.json']
            }
        },
        script_list : {
            dev : {},
            release :{}
        },
        bump: {
            options: {
                files: ['package.json'],
                updateConfigs: [],
                commit: true,
                commitMessage: 'Release v%VERSION%',
                commitFiles: ['-a'],
                createTag: true,
                tagName: 'v%VERSION%',
                tagMessage: 'Version %VERSION%',
                push: true,
                pushTo: 'origin',
                gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d',
                globalReplace: false,
                prereleaseName: false,
                metadata: '',
                regExp: false
            }
        },
        strip_code: {
            options: {
                blocks: [
                    {
                        start_block: "/* begin-strip-block */",
                        end_block: "/* end-strip-block */"
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
                    replacements: [{
                        pattern: '{{ VERSION }}',
                        replacement: '<%= pkg.version %>'
                    }]
                }
            }
        },
        fileExists: {
            project: ['project/'+project_name]
        },
        concat: {
            options: {
                separator: ';'
            },
            lib: {
                src: moduleScriptList,
                dest: 'temp/scripts/main.js'
            },
            script: {
                src: buildScriptList(),
                dest: 'temp/scripts/main.js'
            }
        },

        copy: {
            irpz: {
                expand :true,
                cwd: 'project/',
                src: [project_name],
                dest: 'temp'
            }
        },
        rename: {
            toIrpz: {
                src: 'build/myproject.zip',
                dest: 'build/' + project_name_no_ext + '<%= pkg.version %>.' + project_extension
            }
        },
        clean: {
            all: {
                src: [ 'temp', 'build' ]
            },
            prepare:{
                src: [ 'temp/*' + project_extension, 'temp/scripts/*.js']
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
                src: 'temp/' + project_name,
                dest: 'temp/'
            }
        }

    });

    grunt.loadNpmTasks('grunt-rename');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-zip');
    grunt.loadNpmTasks('grunt-file-exists');
    grunt.loadNpmTasks('grunt-bump');
    grunt.loadNpmTasks('grunt-version');
    grunt.loadNpmTasks('grunt-strip-code');
    grunt.loadNpmTasks('grunt-string-replace');

    // Общий скрипт проекта состоит из глобальных скриптов (модулей), прописанных в dependencies
    // и локальных скриптов прописанных projectScripts

    grunt.registerMultiTask('script_list', 'Building scripts list', function(name, value){
        // Создаем массив модулей, прописанных в dependencies
        // Предполагается, что модуль состоит из одного файла index.js

        var dependencies = getPackageValue('dependencies');


        for (obj in dependencies){
            var modulePath = 'node_modules/' + obj;
            var moduleIndex = modulePath + '/index.js';
            var moduleJsonPath = modulePath + '/package.json';
            // if (!grunt.file.exists(modulePath)) {
            //     // Завершаем grunt-cкрипт с ошибкой
            //     grunt.fail.warn('Script not found: ' + modulePath);
            // }

            if (!grunt.file.exists(moduleJsonPath)) {
                // Завершаем grunt-cкрипт с ошибкой
                grunt.fail.warn('No package.json in the module: ' + moduleJsonPath);
            }

            var moduleJson = grunt.file.readJSON(moduleJsonPath);
            var moduleVersion  = moduleJson ? moduleJson.version : null;

            grunt.log.writeln('Script: ' + moduleIndex + '  (v.' + moduleVersion +')');

            var moduleDependencies = moduleJson.projectScripts;

            if (!moduleDependencies && !grunt.file.exists(moduleIndex)) {
                grunt.fail.warn('package.json doesn\'t have projectScripts and index.js not found');
            }

            if (moduleDependencies) {
                for (var i = 0; i < moduleDependencies.length; i++) {
                    var script = modulePath + '/' + moduleDependencies[i];
                    console.log('adding script ' + script);
                    moduleScriptList.push(script);
                }
            } else {
                moduleScriptList.push(moduleIndex);
                grunt.log.writeln('Script: ' + moduleIndex );
            }

        }
    });


    grunt.registerMultiTask('readpkg', 'Read in the package.json file', function() {
        grunt.config.set('pkg', grunt.file.readJSON('./package.json'));
    });

    grunt.registerTask('build_release', ['script_list:release', 'bump:minor', 'readpkg',
        'clean:all', 'fileExists','copy:irpz', 'unzip', 'clean:prepare', 'concat', 'strip_code',
        'string-replace', 'uglify', 'compress', 'rename']);

    grunt.registerTask('build_script', ['script_list:dev',
        'clean:all', 'copy:irpz', 'unzip', 'clean:prepare', 'concat', 'strip_code',
        'version:project:patch', 'readpkg', 'string-replace']);

    grunt.registerTask('build', ['script_list:dev',
        'clean:all', 'fileExists','copy:irpz', 'unzip', 'clean:prepare', 'concat', 'strip_code',
        'version:project:patch', 'readpkg', 'string-replace','compress', 'rename']);

    grunt.registerTask('build_from_temp', ['compress', 'rename']);
};
