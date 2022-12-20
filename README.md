# Approov QuickStart - NodeJS NestJS Token Check

[Approov](https://approov.io) is an API security solution used to verify that requests received by your backend services originate from trusted versions of your mobile apps.

This repo implements the Approov server-side request verification code for the NodeJS NextJS framework , which performs the verification check before allowing valid traffic to be processed by the API endpoint.


## Approov Integration Quickstart

The quickstart was tested with the following Operating Systems:

* Ubuntu 20.04
* MacOS Big Sur
* Windows 10 WSL2 - Ubuntu 20.04

First, setup the [Approov CLI](https://approov.io/docs/latest/approov-installation/index.html#initializing-the-approov-cli).

Now, register the API domain for which Approov will issues tokens:

```bash
approov api -add api.example.com
```

> **NOTE:** By default a symmetric key (HS256) is used to sign the Approov token on a valid attestation of the mobile app for each API domain it's added with the Approov CLI, so that all APIs will share the same secret and the backend needs to take care to keep this secret secure.
>
> A more secure alternative is to use asymmetric keys (RS256 or others) that allows for a different keyset to be used on each API domain and for the Approov token to be verified with a public key that can only verify, but not sign, Approov tokens.
>
> To implement the asymmetric key you need to change from using the symmetric HS256 algorithm to an asymmetric algorithm, for example RS256, that requires you to first [add a new key](https://approov.io/docs/latest/approov-usage-documentation/#adding-a-new-key), and then specify it when [adding each API domain](https://approov.io/docs/latest/approov-usage-documentation/#keyset-key-api-addition). Please visit [Managing Key Sets](https://approov.io/docs/latest/approov-usage-documentation/#managing-key-sets) on the Approov documentation for more details.

Next, enable your Approov `admin` role with:

```bash
eval `approov role admin`
````

For the Windows powershell:

```bash
set APPROOV_ROLE=admin:___YOUR_APPROOV_ACCOUNT_NAME_HERE___
````

Now, get your Approov Secret with the [Approov CLI](https://approov.io/docs/latest/approov-installation/index.html#initializing-the-approov-cli):

```bash
approov secret -get base64
```

Next, add the [Approov secret](https://approov.io/docs/latest/approov-usage-documentation/#account-secret-key-export) to your environment:

```bash
export APPROOV_BASE64_SECRET=approov_base64_secret_here
```

Now, for the JWT token check we will use this [JWT dependency](https://github.com/auth0/node-jsonwebtoken#readme), that may already exist on your project in case you have `@nestjs/jwt` listed on your `package.json` file. If you aren't using it yet, add it with:

```json
"@nestjs/jwt": "^9.0.0",
```

Next, you need to add the `middleware/approov-token.middleware.ts` to your project:

```javascript
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';

const approovBase64Secret = process.env.APPROOV_BASE64_SECRET

if (!approovBase64Secret) {
  throw new Error("The APPROOV_BASE64_SECRET env var is not set.")
}

const approovSecret = Buffer.from(approovBase64Secret, 'base64')

@Injectable()
export class ApproovTokenMiddleware implements NestMiddleware {

  use(req: Request, res: Response, next: NextFunction) {

    const approovToken = req.headers["approov-token"]

    if (!approovToken) {
      // You may want to add some logging here
      throw new UnauthorizedException('Unauthorized Access')
    }

    verify(`${approovToken}`, approovSecret, { algorithms: ['HS256'] }, function(err, decoded) {

      if (err) {
        // You may want to add some logging here
        throw new UnauthorizedException('Unauthorized Access')
      }

      console.debug("Approov token decoded: ", decoded)

      if (!decoded["exp"]) {
        // You may want to add some logging here
        throw new UnauthorizedException('Unauthorized Access')
      }

      // Adding the Approov token claims to the request object so that other
      // parts of the request life cycle can access it. For example, the Approov
      // token binding middleware.
      req["approovTokenClaims"] = decoded;
    });

    next();
  }
}
```

Finally, enable the use of the Approov token middleware on your App module:

```javascript
import { ApproovTokenMiddleware } from './middleware/approov-token.middleware';

export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Ensure that the ApproovTokenMiddleware is always the first one to be
    // executed. For example, do not execute a rate limiter Middleware first.
    consumer.apply(ApproovTokenMiddleware).forRoutes('*');
  }
}
```

This enables the Approov token check for all your API endpoints. While its possible to enable Approov in a per endpoint basis we strongly recommend you to not do so, unless you have an application consuming the API endpoint that cannot be protected with the Approov SDK. Billing shouldn't be also a concern on the decision process for the number of API endpoints to be protected with Approov, because you are billed based on the number of monthly active devices, not on the the number of API requests made or API endpoints protected.

The *ApproovTokenMiddleware* should be the first one to be executed, because it's establishing if you can trust in the incoming request as one coming from **what** your API backend expects, a genuine and unmodified version of your mobile app that is running in a trusted device, where a MitM attack is not being carried out. You don't want to waste your API server resources with processing API requests from untrustworthy sources, like bots and one of API requests made with tools like cURL, Postman and others.

Not enough details in the bare bones quickstart? No worries, check the [detailed quickstarts](QUICKSTARTS.md) that contain a more comprehensive set of instructions, including how to test the Approov integration.


## More Information

* [Approov Overview](OVERVIEW.md)
* [Detailed Quickstarts](QUICKSTARTS.md)
* [Examples](EXAMPLES.md)
* [Testing](TESTING.md)

### System Clock

In order to correctly check for the expiration times of the Approov tokens is very important that the backend server is synchronizing automatically the system clock over the network with an authoritative time source. In Linux this is usually done with a NTP server.


## Issues

If you find any issue while following our instructions then just report it [here](https://github.com/approov/quickstart-nodejs-nestjs-token-check/issues), with the steps to reproduce it, and we will sort it out and/or guide you to the correct path.


## Useful Links

If you wish to explore the Approov solution in more depth, then why not try one of the following links as a jumping off point:

* [Approov Free Trial](https://approov.io/signup)(no credit card needed)
* [Approov Get Started](https://approov.io/product/demo)
* [Approov QuickStarts](https://approov.io/docs/latest/approov-integration-examples/)
* [Approov Docs](https://approov.io/docs)
* [Approov Blog](https://approov.io/blog/)
* [Approov Resources](https://approov.io/resource/)
* [Approov Customer Stories](https://approov.io/customer)
* [Approov Support](https://approov.io/contact)
* [About Us](https://approov.io/company)
* [Contact Us](https://approov.io/contact)
