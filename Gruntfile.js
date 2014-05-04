module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-jsonlint');
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    jshint: {
      files: ['*.js', 'lib/**/*.js', 'test/**/*.js'],
      options: {
        globals: {
          console: true,
          module: true
        },
      },
    },

    jsonlint: {
      files: ['*.json', 'lib/**/*.json', 'test/**/*.json'],
    },

    mochaTest: {
      test: {
        src: ['test/**/*.js', '!test/fixture/**/*.js'],
        options: {
          reporter: 'spec',
          growl: true,
        },
      },
    },

    watch: {
      files: ['<%= jshint.files %>'],
      tasks: ['jshint', 'jsonlint', 'mochaTest'],
    },
  });

  grunt.registerTask('default', ['jshint', 'jsonlint', 'mochaTest']);
};
