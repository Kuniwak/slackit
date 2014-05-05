/* jshint expr: true */
var url = require('url');
var path = require('path');
var fork = require('child_process').fork;

var stub = require('sinon').stub;
var spy = require('sinon').spy;
var sinonChai = require("sinon-chai");
var chai = require('chai');
chai.use(sinonChai);
var expect = chai.expect;
var extend = require('util-extend');
var winston = require('winston');

var SendBot = require('../').SendBot;

describe('SendBot', function() {
  // Hide log messages between tests
  var logLevel;
  before(function() {
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
    winston.level = 'warn';
  });
  after(function() {
    logLevel = winston.level;
  });

  /**
   * Valid options to construct the SendBot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTION = {
    teamname: 'example',
    channel: '#general',
    botname: 'testbot',
    incomingHookToken: 'AAAAAAAAAAAAAAAAAAAAAAAA',
  };

  /**
   * Valid options to construct the SendBot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTIONS_HTTP = extend({
    http: true,
  }, VALID_OPTION);

  /**
   * Default the URL to Slack server.
   * @type {string}
   */
  var INCOMING_HOOK_URI = url.format({
    protocol: 'https',
    hostname: 'example.slack.com',
    pathname: 'services/hooks/incoming-webhook',
    query: { 'token': 'AAAAAAAAAAAAAAAAAAAAAAAA' },
  });

  /**
   * Listen port of the fixture server.
   * The server will echo the given request to the port.
   * @see test/fixture/server.js
   * @type {number}
   */
  var INCOMING_HOOK_PORT = 9000;

  /**
   * URL to the fixture server.
   * NOTE: The protocol should use SSL.
   * @type {string}
   */
  var INCOMING_HOOK_URI_FIXTURE = url.format({
    protocol: 'http',
    hostname: 'localhost',
    port: INCOMING_HOOK_PORT,
    pathname: 'services/hooks/incoming-webhook',
    query: { 'token': 'AAAAAAAAAAAAAAAAAAAAAAAA' },
  });

  // We should test request over the HTTP connection.
  var incomingHookProcess;
  before(function(done) {
    // Start a fixture server.
    incomingHookProcess = fork(path.join(__dirname, 'fixture', 'incoming_hook'),
                         [String(INCOMING_HOOK_PORT)]);
    incomingHookProcess.on('message', function(res) {
      if (!res || !res.ready) {
        throw Error('Cannot start the fixture server.');
      }
      done();
    });
  });

  after(function() {
    incomingHookProcess.kill();
  });


  describe('#constructor', function() {
    it('should construct the bot', function() {
      var sendbot = new SendBot(VALID_OPTION);
      expect(sendbot).to.be.instanceof(SendBot);
    });

    it('should construct the bot with no channel', function() {
      var validOptions = extend({}, VALID_OPTION);
      delete validOptions.channel;

      var sendbot = new SendBot(validOptions);
      expect(sendbot).to.be.instanceof(SendBot);
    });

    it('should throw an exception when given no options', function() {
      expect(function() {
        new SendBot();
      }).to.throw(Error);
    });

    it('should throw an exception when given no incomingHookToken', function() {
      expect(function() {
        var invalidOptions = extend({}, VALID_OPTION);
        delete invalidOptions.incomingHookToken;

        new SendBot(invalidOptions);
      }).to.throw(Error);
    });

    it('should throw an exception when given no teamname', function() {
      expect(function() {
        var invalidOptions = extend({}, VALID_OPTION);
        delete invalidOptions.teamname;

        new SendBot(invalidOptions);
      }).to.throw(Error);
    });

    it('should throw an exception when given no botname', function() {
      expect(function() {
        var invalidOptions = extend({}, VALID_OPTION);
        delete invalidOptions.botname;

        new SendBot(invalidOptions);
      }).to.throw(Error);
    });
  });


  describe('#start', function() {
    it('should be implemented', function() {
      var sendbot = new SendBot(VALID_OPTION);
      expect(sendbot).to.have.property('start').that.is.a('function');
    });
  });


  describe('#stop', function() {
    it('should be implemented', function() {
      var sendbot = new SendBot(VALID_OPTION);
      expect(sendbot).to.have.property('stop').that.is.a('function');
    });
  });


  describe('#say', function() {
    /**
     * Expects the specified message object has:
     *
     * - using valid URI for incoming WebHooks
     * - using the `POST` method
     * - using a Content-Type as `application/x-www-form-urlencoded`
     * - including a `payload` as a form parameter
     *
     * @param {*} expectMsgObj Expected message object.
     * @param {*} actualBody Response object as a JSON.
     */
    var expectMsgObj = function(expectedMsgObj, actualBody) {
        expect(actualBody).to.be.an('string');
        var body = JSON.parse(actualBody);
        // Check the HTTP content.
        expect(body).to.have.property('url', url.parse(INCOMING_HOOK_URI_FIXTURE).path);
        expect(body).to.have.property('method', 'POST');
        expect(body).to.have.deep.property('headers.content-type')
            .that.include('application/x-www-form-urlencoded');
        expect(body).to.have.deep.property('body.payload').that.is.a('string');

        // Check the POST body.
        var requestBody = JSON.parse(body.body.payload);
        expect(requestBody).to.have.property('text', expectedMsgObj.text);
        expect(requestBody).to.have.property('channel', expectedMsgObj.channel);

        if ('botname' in expectedMsgObj) {
          expect(requestBody).to.have.property('botname', expectedMsgObj.botname);
        }
        if ('icon_emoji' in expectedMsgObj) {
          expect(requestBody).to.have.property('icon_emoji', expectedMsgObj.icon_emoji);
        }
    };


    before(function() {
      // Spy SendBot#getIncomingHookURI to return an URL to the fixture server.
      // It requests to the fixture server on `INCOMING_HOOK_URI_FIXTURE`.
      // This fixture server should echoes a request content as JSON.
      stub(SendBot.prototype, 'getIncomingHookURI');
      SendBot.prototype.getIncomingHookURI.returns(INCOMING_HOOK_URI_FIXTURE);
    });

    after(function() {
      SendBot.prototype.getIncomingHookURI.restore();
    });

    it('should call getIncomingHookURI to get an incoming WebHooks URI', function() {
      // This behavior is necessary because tests for `#say` expect to be able
      // to stub `#getIncomingHookURI`. This stubbing make tests reality.
      var sendbot = new SendBot(VALID_OPTION);
      sendbot.say('test');
      expect(sendbot.getIncomingHookURI).to.have.property('called').that.is.true;
    });

    it('should send a message by given a text (#general should be used)', function(done) {
      var msg = '0123456789abcdABCD @+-_!?/:"\'';
      var sendbot = new SendBot(VALID_OPTION);

      sendbot.say(msg, function(err, response, jsonBody) {
        // Use #general channel as default.
        var expected = {
          text: msg,
          channel: '#general',
        };
        expectMsgObj(expected, jsonBody);
        done();
      });
    });

    it('should send a message by given an object has a text (#general should be used)', function(done) {
      var msgObj = {
        text: '0123456789abcdABCD @+-_!?/:"\''
      };
      var sendbot = new SendBot(VALID_OPTION);

      sendbot.say(msgObj, function(err, response, jsonBody) {
        // Use #general channel as default.
        var expected = {
          text: msgObj.text,
          channel: '#general',
        };
        expectMsgObj(expected, jsonBody);
        done();
      });
    });

    it('should send a message by given an object has a text, channel, botname, icon_emoji', function(done) {
      var msgObj = {
        text: '0123456789abcdABCD @+-_!?/:"\'',
        channel: '#playground',
        botname: 'sendbot',
        icon_emoji: ':ghost:',
      };
      var sendbot = new SendBot(VALID_OPTION);

      sendbot.say(msgObj, function(err, response, jsonBody) {
        // Use #general channel as default.
        var expected = msgObj;
        expectMsgObj(expected, jsonBody);
        done();
      });
    });
  });


  describe('#getIncomingHookURI', function() {
    it('should return a default incoming hook URI', function() {
      // This spec is important because tests for #say need to be able to switch
      // the real server to the mock server.
      var sendbot = new SendBot(VALID_OPTION);
      expect(sendbot.getIncomingHookURI()).to.be.equal(INCOMING_HOOK_URI);
    });
  });
});
