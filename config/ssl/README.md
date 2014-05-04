# Using SSL certificates
We recommended to use your verifiable certificate.

When your certificate was not given, ReceptBot (and BasicBot) generate self signed certification to make hard to sniffing chat message over outgoing WebHooks.
But self sined certificates can not defence [MITM attack](http://en.wikipedia.org/wiki/Man-in-the-middle_attack#Example_of_an_attack), so attackers can read message by the method.
In this case, you can defence the MITM attack by using a verifiable certificate.

But maybe you should purchase the verifiable certificate.

## How to use my certificate
1. Locate your certificate

    Put your certificate to `config/ssl/`.

2. Add https option

    Add the `https` option to the _recept_ section in `config/config.json`.

        "recept": {
          "outgoingHookToken": "XXXXXXXXXXXXXXXXXXXXXXXX"

          "options": {
            https: {
              key: 'config/ssl/key.pem',
              cert: 'config/ss/cert.pem'
            }
          }
        }
