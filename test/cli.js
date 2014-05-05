/* jshint expr: true */
var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;

var sinon = require('sinon');
var spy = sinon.spy;
var chai = require('chai');
var sinonChai = require('sinon-chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(sinonChai);
chai.use(chaiAsPromised);
var expect = chai.expect;

var BIN_PATH = '../bin/cli.js';
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
      if (!main) {
        return done();
      }

      main.getPromisedBot()
          .then(function(bot) {
            bot.stop();
            done();
          }, function() {
            done();
          });
    });

    describe('#constructor', function() {
      it('should be done with config file', function() {
        var argv = ['node', 'bin/bot.js', '-c', 'test/fixture/config/config.json'];
        main = new Main(argv);
        return expect(main.getPromisedBot()).to.be.fulfilled;
      });

      it('should be failed with config file is not existed', function() {
        var argv = ['node', 'bin/bot.js', '-c', 'test/fixture/config/nothing.json'];
        main = new Main(argv);
        return expect(main.getPromisedBot()).to.be.rejected;
      });

      it('should be failed with config file is not JSON', function() {
        var argv = ['node', 'bin/bot.js', '-c', 'test/fixture/config/config.js'];
        main = new Main(argv);
        return expect(main.getPromisedBot()).to.be.rejected;
      });
    });

    describe('#getPromisedBot', function() {
      it('should return a promised bot', function() {
        var argv = ['node', 'bin/bot.js', '-c', 'test/fixture/config/config.json'];
        main = new Main(argv);
        return expect(main.getPromisedBot()).to.eventually.have.property('start').that.is.a('function');
      });
    });
  });
});
