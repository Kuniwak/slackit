var url = require('url');
var fork = require('child_process').fork;
var expect = require('chai').expect;
var stub = require('sinon').stub;

var Statbot = require('../');

describe('Statbot', function() {
  /**
   * Valid options to construct the Statbot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTIONS = {
    teamname: 'example',
    channel: 'general',
    username: 'testbot',
    incomingHookToken: 'AAAAAAAAAAAAAAAAAAAAAAAA'
  };

  /**
   * Invalid options to construct the Statbot.
   */
  var INVALID_OPTIONS = {};

  /**
   * Default the URL to Slack server.
   * @type {string}
   */
  var INCOMING_HOOK_URI = 'https://example.slack.com/services/hooks/' +
                          'incoming-webhook?token=AAAAAAAAAAAAAAAAAAAAAAAA';


  /**
   * URL to the fixture server.
   * @type {string}
   */
  var INCOMING_HOOK_URI_FIXTURE = 'http://localhost:9000/services/hooks/' +
                                  'incoming-webhook?token=AAAAAAAAAAAAAAAAAAAAAAAA';

  /**
   * Server port for the fixture server.
   * The server will echo the given request.
   * @see test/fixture/server.js
   */
  var FIXTURE_SERVER_PORT = 9000;


  // We should test request over the HTTP connection.
  var serverProcess;
  before(function(done) {
    // Start a fixture server.
    serverProcess = fork(__dirname + '/fixture/server', [String(FIXTURE_SERVER_PORT)]);
    serverProcess.on('message', function(res) {
      if (!res || res.type !== 'listened') {
        throw Error('Cannot start the fixture server.');
      }
      done();
    });
  });

  after(function() {
    serverProcess.kill();
  });


  describe('#constructor', function() {
    it('should throw an exception when given no options', function() {
      expect(function() {
        new Statbot();
      }).to.throw(Error);
    });

    it('should throw an exception when given invalid options', function() {
      expect(function() {
        new Statbot(INVALID_OPTIONS);
      }).to.throw(Error);
    });

    it('should construct the bot', function() {
      expect(function() {
        new Statbot(VALID_OPTIONS);
      }).to.not.throw(Error);
    });
  });


  describe('#say', function() {
    before(function() {
      // Spy Statbot#getIncomingHookURI to return an URL to the fixture server.
      // It requests to the fixture server on `INCOMING_HOOK_URI_FIXTURE`.
      // This fixture server should echoes a request content as JSON.
      stub(Statbot.prototype, 'getIncomingHookURI');
      Statbot.prototype.getIncomingHookURI.returns(INCOMING_HOOK_URI_FIXTURE);
    });

    after(function() {
      Statbot.prototype.getIncomingHookURI.restore();
    });


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

        if ('username' in expectedMsgObj) {
          expect(requestBody).to.have.property('username', expectedMsgObj.username);
        }
        if ('icon_emoji' in expectedMsgObj) {
          expect(requestBody).to.have.property('icon_emoji', expectedMsgObj.icon_emoji);
        }
    };

    it('should send a message by given a text (#general should be used)', function(done) {
      var msg = '0123456789abcdABCD @+-_!?/:"\'';
      var statbot = new Statbot(VALID_OPTIONS);

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
      var statbot = new Statbot(VALID_OPTIONS);

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

    it('should send a message by given an object has a text, channel, username, icon_emoji', function(done) {
      var msgObj = {
        text: '0123456789abcdABCD @+-_!?/:"\'',
        channel: '#playground',
        username: 'statbot',
        icon_emoji: ':ghost:',
      };
      var statbot = new Statbot(VALID_OPTIONS);

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
      var statbot = new Statbot(VALID_OPTIONS);
      expect(statbot.getIncomingHookURI()).to.be.equal(INCOMING_HOOK_URI);
    });
  });
});
