/* jshint expr: true */
var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;

var chai = require('chai');
var expect = chai.expect;

var BIN_PATH = '../bin/bot.js';
var Main = require(BIN_PATH);

describe('Command line interface', function() {
  it('should be executable', function(done) {
    var OWNER_EXECUTABLE_MASK = parseInt('0100', 8);
    var GROUP_EXECUTABLE_MASK = parseInt('0010', 8);
    var OTHERS_EXECUTABLE_MASK = parseInt('0001', 8);

    fs.stat(path.join(__dirname, BIN_PATH), function(err, stats) {
      expect(err).to.be.null;
      expect(stats.mode & OWNER_EXECUTABLE_MASK).to.be.ok;
      expect(stats.mode & GROUP_EXECUTABLE_MASK).to.be.ok;
      expect(stats.mode & OTHERS_EXECUTABLE_MASK).to.be.ok;
      done();
    });
  });

  describe('Main', function() {
    var main;
    afterEach(function(done) {
      main.getPromisedBot().then(function(bot) {
        bot.close();
        done();
      });
    });

    it('should run a bot when the instance was constructed', function() {
      main = new Main(['node', 'bin/bot.js', '-c', 'test/fixture/config/config.json']);
    });
  });
});
