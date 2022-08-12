# Approov Unprotected Server Example

The Appproov unprotected example is the base reference to build the [Approov protected servers](/src/approov-protected-server/).

This basic server example was borrowed from the sample/19-auth-jwt at the nestjs/nest Github repo at commit 7389070b868e74645c4954e5794abf04890e79d5.

The sample/19-auth-jwt was chosen to illustrate that the Approov integration is easily added without any interference whatsoever with your current user authentication system, because once the Approov integration of Approov is done via Middleware, it gets executed before user authentication.


## TOC - Table of Contents

* [Why?](#why)
* [How it Works?](#how-it-works)
* [Requirements](#requirements)
* [Try It](#try-it)


## Why?

To be the starting building block for the [Approov protected servers](/src/approov-protected-server/), that will show you how to lock down your API server to your mobile app. Please read the brief summary in the [Approov Overview](/OVERVIEW.md#why) at the root of this repo or visit our [website](https://approov.io/product/) for more details.

[TOC](#toc---table-of-contents)


## How it works?

The NestJS server is very simple and is defined at [src/unprotected-server](/src/unprotected-server).

The server answers to requests on the endpoint `/` with the message:

```json
{"message": "Hello, World!"}
```

It also answers to the endpoint `auth/login` and `/profile` to show how to access an endpoint behind user authentication, that is not protected to only be abused by bots and attackers. Bots can query the `/auth/login` for trying out user enumeration, and the `/profile` endpoint can be easily used with a stolen Authorization token, because the NestJS serve have no way to distinguish API requests from un-trusted sources the ones of the genuine and unmodified versions of the applications it was built to serve, but we fix this with the Approov integration.

[TOC](#toc---table-of-contents)


## Requirements

To run this example you will need to have NodeJS installed. If you don't have then please follow the official installation instructions from [here](https://nodejs.org/en/download/) to download and install it.

[TOC](#toc---table-of-contents)


## Try It

First install the dependencies. From the `src/unprotected-server` folder execute:

```text
npm install
```

Now, you can run this example from the `src/unprotected-server` folder with:

```text
npm start
```

Finally, you can test that it works with:

```text
curl -iX GET 'http://localhost:8002'
```

The response will be:

```text
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 27
ETag: W/"1b-tDnArHZ232y12bSoTiMc+/cz4as"
Date: Fri, 12 Aug 2022 16:48:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"message": "Hello, World!"}
```

### API Abuse Allowed

Do you know what happens when you have a user that had is username and password breached in another service he uses, and an attacker in possession of his breached credentials tries to see if he has an account in your service with the same password?

Lets' imagine that such user as the username `john` and password `changeme` on the data-breach the attacker had access, therefore all he needs to do to know if John uses the same credentials on your service is to just issue a `cURL` request to the `/auth/login` endpoint and see if a `200` response is returned:

```bash
curl -X POST http://localhost:8002/auth/login -d '{"username": "john", "password": "changeme"}' -H "Content-Type: application/json"
```

The output:

```json
{"access_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImpvaG4iLCJzdWIiOjEsImlhdCI6MTY2MDMyMjk2NCwiZXhwIjoxNjYwMzIzMDI0fQ.t_eQlw31_j3ZwIgW9WNkLhZ9U8uS0Fl8mS2Fco3fEBA"}
```

Bingo, the attacker got a `200` response and an access token that will allow him to query your API in the behalf of your user.

Yes, it's not your fault that the user uses the same credentials in other services, but stop for a moment and think what would be the impact for your business, both financial and reputational, if your users would have their account with your business hacked?

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
