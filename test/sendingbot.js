/* jshint expr: true */
var url = require('url');
var path = require('path');
var fork = require('child_process').fork;
var expect = require('chai').expect;
var stub = require('sinon').stub;
var extend = require('util-extend');

var SendingBot = require('../').SendingBot;

describe('SendingBot', function() {
  /**
   * Valid options to construct the SendingBot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTIONS_HTTPS = {
    teamname: 'example',
    channel: '#general',
    botname: 'testbot',
    incomingHookToken: 'AAAAAAAAAAAAAAAAAAAAAAAA',
  };

  /**
   * Valid options to construct the SendingBot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTIONS_HTTP = extend({
    http: true,
  }, VALID_OPTIONS_HTTPS);

  /**
   * Invalid options to construct the SendingBot.
   */
  var INVALID_OPTIONS = {};

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
    it('should throw an exception when given no options', function() {
      expect(function() {
        new SendingBot();
      }).to.throw(Error);
    });

    it('should throw an exception when given invalid options', function() {
      expect(function() {
        new SendingBot(INVALID_OPTIONS);
      }).to.throw(Error);
    });

    it('should construct the bot', function() {
      var statbot = new SendingBot(VALID_OPTIONS_HTTPS);
      expect(statbot).to.be.instanceof(SendingBot);
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
      // Spy SendingBot#getIncomingHookURI to return an URL to the fixture server.
      // It requests to the fixture server on `INCOMING_HOOK_URI_FIXTURE`.
      // This fixture server should echoes a request content as JSON.
      stub(SendingBot.prototype, 'getIncomingHookURI');
      SendingBot.prototype.getIncomingHookURI.returns(INCOMING_HOOK_URI_FIXTURE);
    });

    after(function() {
      SendingBot.prototype.getIncomingHookURI.restore();
    });

    it('should call getIncomingHookURI to get an incoming WebHooks URI', function() {
      // This behavior is necessary because tests for `#say` expect to be able
      // to stub `#getIncomingHookURI`. This stubbing make tests reality.
      var statbot = new SendingBot(VALID_OPTIONS_HTTPS);
      statbot.say('test');
      expect(statbot.getIncomingHookURI).to.have.property('called').that.is.true;
    });

    it('should send a message by given a text (#general should be used)', function(done) {
      var msg = '0123456789abcdABCD @+-_!?/:"\'';
      var statbot = new SendingBot(VALID_OPTIONS_HTTPS);

      statbot.say(msg, function(err, response, jsonBody) {
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
      var statbot = new SendingBot(VALID_OPTIONS_HTTPS);

      statbot.say(msgObj, function(err, response, jsonBody) {
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
        botname: 'statbot',
        icon_emoji: ':ghost:',
      };
      var statbot = new SendingBot(VALID_OPTIONS_HTTPS);

      statbot.say(msgObj, function(err, response, jsonBody) {
        // Use #general channel as default.
        var expected = msgObj;
        expectMsgObj(expected, jsonBody);
        done();
      });
    });
  });


  describe('#getIncomingHookURI', function() {
    it('should return a default incoming hook URI', function() {
      var statbot = new SendingBot(VALID_OPTIONS_HTTPS);
      expect(statbot.getIncomingHookURI()).to.be.equal(INCOMING_HOOK_URI);
    });
  });
});
