#!/usr/bin/env node

var fs = require('fs');
var path = require('path');

var winston = require('winston');
var promisedFs = require('promised-io/fs');
var Promise = require('promised-io/promise').Promise;

var BotFactory = require('../lib/botfactory');



/**
 * Customizable entry point to start the bot.
 * You can override methods to use your custom bot.
 * The main should start the bot when the main instance is created.
 *
 * @constructor
 */
var Main = function(argv) {
  this.argv = argv;
  this.bot = this.getPromisedBot();
  this.bot.then(null, function logError(err) {
    winston.error(err.message + ':', err);
  });
};


/**
 * Returns a promised options.
 * @param {Array.<string>} argv Given arguments.
 * @return {PromiseLike.<Object>} Promised option that is hash map of the
 *    argument name and the value.
 * @protected
 */
Main.prototype.getPromisedOptions = function() {
  var promise = new Promise();
  var that = this;

  process.nextTick(function() {
    var bot = require('commander');
    var packageInfo = require('../package.json');

    bot
      .version(packageInfo.version)
      .usage('[options]')
      .option('-v, --verbose', 'output verbose messages (it have priority over -s)')
      .option('-s, --silent',  'suppress output messages')
      .option('-c, --config <file>', 'specify the config file', 'config/config.json')
      .parse(that.argv);

    var revertedSyslogLevels = {
      debug: 0,
      info: 1,
      notice: 2,
      warning: 3,
      error: 4,
      crit: 5,
      alert: 6,
      emerg: 7
    };
    winston.setLevels(revertedSyslogLevels);
    winston.level = bot.verbose ? 'debug' : bot.silent ? 'none' : 'info';

    promise.resolve(bot);
  });

  return promise;
};


/**
 * Returns a promised config.
 * @return {PromiseLike.<Object>} Promised config.
 * @protected
 */
Main.prototype.getPromisedConfig = function() {
  return this.getPromisedOptions()
      .then(function loadConfig(opts) {
        var configPath = path.join(__dirname, '..', opts.config);
        var promise = new Promise();

        if (path.extname(configPath).toLowerCase() !== '.json') {
          throw Error('Config file should be as be JSON but come: ' + configPath);
        }
        return require(configPath);
      })
      .then(null, function handleENOENT(err) {
        if (err.code === 'ENOENT') {
          throw Error('Cannot read config file: ' + err.message);
        }
        throw err;
      });
};


/**
 * Returns a promised bot.
 * @return {PromiseLike.<BotLike>} Promised bot.
 */
Main.prototype.getPromisedBot = function() {
  return this.bot ? this.bot : this.getPromisedConfig()
      .then(function createBot(cfg) {
        var bot = BotFactory.createByConfig(cfg);
        bot.start();
        return bot;
      });
};


if (!module.parent) {
  new Main(process.argv);
}
else {
  module.exports = Main;
}
