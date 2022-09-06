# Approov Token Integration Example

This Approov integration example is from where the code example for the [Approov token check quickstart](/docs/APPROOV_TOKEN_QUICKSTART.md) is extracted, and you can use it as a playground to better understand how simple and easy it is to implement [Approov](https://approov.io) in a NodeJS API server.

## TOC - Table of Contents

* [Why?](#why)
* [How it Works?](#how-it-works)
* [Requirements](#requirements)
* [Try the Approov Integration Example](#try-the-approov-integration-example)


## Why?

To lock down your API server to your mobile app. Please read the brief summary in the [Approov Overview](/OVERVIEW.md#why) at the root of this repo or visit our [website](https://approov.io/product/) for more details.

[TOC](#toc---table-of-contents)

## How it works?

The server answers to requests on the endpoint `/` with the message:

```json
{"message": "Hello, World!"}
```

It also answers to the endpoint `auth/login` and `/profile` to show how an endpoint behind user authentication is secured with Approov to protected against being abused by bots and attackers. Without the Approov token check an user enumeration attack could be easily carried out on the `/auth/login` endpoint for trying out user credentials from a breached database, and the `/profile` endpoint could be easily used with a stolen Authorization token, but now this attacks are blocked by the Approov token check at the very start of the API request life cycle.

Before the Approov integration the API requests could be made from any source (your App, cURL, Postman, Bots, etc.), trusted or not, that the API server would fulfill them, provided they were well formed, but that's not the case anymore, once the API server now requires a valid Approov token to assert that the API request is indeed from **what** it expects, a genuine and unmodified application (usually a mobile app) that is allowed to use the API server.

The NestJS API server is very simple and is defined at [src/approov-protected-server/token-check](/src/approov-protected-server/token-check). Take a look at the [Approov Token Middleware](/src/approov-protected-server/token-check/src/middleware/approov-token.middleware.ts) to see the simple code for the check.

For more background on Approov, see the [Approov Overview](/OVERVIEW.md#how-it-works) at the root of this repo.



[TOC](#toc---table-of-contents)


## Requirements

To run this example you will need to have NodeJS installed. If you don't have then please follow the official installation instructions from [here](https://nodejs.org/en/download/) to download and install it.

[TOC](#toc---table-of-contents)


## Try It

First install the dependencies. From the `src/approov-protected-server/token-check` folder execute:

```text
npm install
```

Now, you can run this example from the `src/approov-protected-server/token-check` folder with:

```text
npm start
```

Finally, you can test that it works with:

```text
curl -iX GET 'http://localhost:8002'
```

The response will be a `401` unauthorized request:

```text
HTTP/1.1 401 Unauthorized
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 73
ETag: W/"49-3hacvK5fZAWYfGdbSWwq5JIVrJM"
Date: Fri, 12 Aug 2022 18:21:54 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"statusCode":401,"message":"Unauthorized Access","error":"Unauthorized"}
```

The reason you got a `401` is because the Approoov token isn't provided in the headers of the request.

Finally, you can test that the Approov integration example works as expected with this [Postman collection](/TESTING.md#testing-with-postman) or with some cURL requests [examples](/TESTING.md#testing-with-curl).

### API Abuse Blocked

Do you know what happens when you have a user that had is username and password breached in another service he uses? Attackers in possession of his breached credentials may try to see if he has an account in your service with the same password via automated scripts. Are you aware of the possible consequences for your users and for your business when an attacker finds a positive match and decides to compromise the user account and/or take it over, thus locking-out the user from being able to use it?

Are you ready to stop this attacks? No, rate limiting is not enough, because it only makes the attack slower, and if your API server returns a response header with the current rate limit, then the attacker can very easily work around your rate limiter by auto throttling down itself to stay under such rate limits. If your API server doesn't return the current rate limit header then it only slows down the attack, because the attacker will automate his bot to make the API requests to your API backend at a very slow rate, thus staying under the undisclosed rate limits, and often they distribute the attack from dozens or hundreds of different IPs, therefore rendering rate limiters a less effective security solution against such attacks.

Lets' imagine that such user as the username `john` and password `changeme` on the data-breach the attacker had access, therefore all he needs to do to know if John uses the same credentials on your service is to just issue a `cURL` request to the `/auth/login` endpoint and see if a `200` response is returned:

```bash
curl -iX POST http://localhost:8002/auth/login -d '{"username": "john", "password": "changeme"}' -H "Content-Type: application/json"
```

The output:

```text
HTTP/1.1 401 Unauthorized
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 73
ETag: W/"49-3hacvK5fZAWYfGdbSWwq5JIVrJM"
Date: Fri, 12 Aug 2022 18:29:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"statusCode":401,"message":"Unauthorized Access","error":"Unauthorized"}
```

Despite the user John being in your system with the same exact credentials the attacker is not able to know that, and he will just think that the user doesn't exist on your system or if it exists doesn't use the same password.

Yes, it's not your fault that the user uses the same credentials in other services, but you have now protected your users from being hacked on your service, despite they had been breached elsewhere. You just have avoided a public relations nightmare for your business and potential reputational and financial losses.

Now, stop for a moment and think what would be the impact for your business, both financial, legal and reputational, if your users would have their account hacked with credentials harvested from someones else data-breach? Would they just accept that you would tell them that was their fault? What would any new potential customers think of your brand after seeing your business associated with such incident in the news and/or social-media?

[TOC](#toc---table-of-contents)


## Issues

If you find any issue while following our instructions then just report it [here](https://github.com/approov/quickstart-nodejs-nestjs-token-check/issues), with the steps to reproduce it, and we will sort it out and/or guide you to the correct path.


[TOC](#toc---table-of-contents)


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

[TOC](#toc---table-of-contents)
