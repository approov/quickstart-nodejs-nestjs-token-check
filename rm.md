# Approov Backend Quickstart - NodeJS NestJS

This project provides a server-side example of Approov token verification for a protected backend API. It exposes a simple API that verifies Approov tokens before granting access to protected endpoints and demonstrates how the endpoints behave under the current Approov configuration:

- `/unprotected` - no Approov token required.
- `/token-check` - requires a valid Approov token.
- `/token-binding` - requires a valid Approov token which is bound to a header value.
- `/token-double-binding` - requires a valid Approov token which is bound to two header values.

In this example, Approov protection is implemented as a NestJS middleware that validates tokens and enforces bindings based on the protected route configuration defined in code.

## Mandatory Approov Logic Mapping

1. **JWT Approov Token validation (signature + expiry)** is implemented in
   [ApproovService.verifyApproovToken + validateExpiration](src/main.ts#L132-L188) - lines 132 to 188.
   It verifies the HS256 signature and rejects tokens that are missing or past `exp`.

2. **Token binding (pay + hash)** is handled by
   [ApproovService.isBindingValid + hashBase64Url](src/main.ts#L160-L173) - lines 160 to 173.
   It computes `base64url(sha256(binding_value))` and compares it to `pay`.

3. **Middleware enforcement** is done by
   [ApproovTokenVerifierMiddleware.use](src/main.ts#L202-L246) - lines 202 to 246.
   Requests without a valid token/binding are rejected with 401.

4. **Binding value selection (what gets hashed)** is in
   [ApproovService.extractBindingValue](src/main.ts#L147-L158) - lines 147 to 158.
   It uses the headers configured in `PROTECTED_ROUTES` (currently `Authorization` for single binding, or `Authorization` + `Content-Digest` for double binding).

5. **Protected route requirements** are defined in
   [PROTECTED_ROUTES](src/main.ts#L58-L62) - lines 58 to 62.

6. **Protected routes are registered** in
   [AppModule.configure](src/main.ts#L332-L341) - lines 332 to 341.

## Approov Token Verification Flow

1. **Token Request**: the Approov SDK inside the mobile app communicates with the Approov Cloud Service to obtain a short-lived Approov Token (a signed JWT).
2. **Token Attachment**: the app attaches this token to each API request using the `Approov-Token` header.
3. **Server Validation**: the server verifies the token signature and expiration and rejects invalid tokens.
4. **Token Binding (Optional)**: the app hashes a binding value (for example the `Authorization` header) and embeds it into the Approov token. The server computes the same hash and compares it to the `pay` claim.
5. **Request Decision**: if all checks pass, the request is trusted (`200 OK`); otherwise the server returns `401 Unauthorized`.

## Requirements

1. **Approov account** - If you're new, sign up for an Approov trial account.
2. **Approov CLI initialized** - Follow the installation guide and confirm `approov whoami` works.
3. **Install curl** - Ensure the `curl` CLI is available.
4. **Create .env file** - copy `.env.example` so there is a place to store the secret key.
   ```bash
   cp .env.example .env
   ```
5. **Configure secret** - fetch the secret and add it to `.env` (`APPROOV_BASE64URL_SECRET`).
   ```bash
   approov secret -get base64url
   ```
6. **Register API domain** - point Approov at your backend API (default example.com).
   ```bash
   approov api -add example.com
   ```

## Run the server

```bash
npm install
npm run start
```

The server listens on `http://localhost:8080` by default. Override the port via `HTTP_PORT` in `.env` if needed.

## Test the endpoints manually

### 1. Unprotected endpoint

```bash
curl -iX GET http://localhost:8080/unprotected
```

### 2. Approov Token Check

```bash
approov token -genExample example.com
```

```bash
curl -iX GET http://localhost:8080/token-check \
  -H "Approov-Token: valid_approov_token_here"
```

### 3. Approov Token Binding Check

```bash
approov token -setDataHashInToken ExampleAuthToken== -genExample example.com
```

```bash
curl -iX GET http://localhost:8080/token-binding \
  -H "Approov-Token: valid_approov_token_here" \
  -H "Authorization: ExampleAuthToken=="
```

### 4. Approov Token Double Binding Check

```bash
approov token -setDataHashInToken ExampleAuthToken==ContentDigest== -genExample example.com
```

```bash
curl -iX GET http://localhost:8080/token-double-binding \
  -H "Approov-Token: valid_approov_token_here" \
  -H "Authorization: ExampleAuthToken==" \
  -H "Content-Digest: ContentDigest=="
```

## Enable or Disable Approov Protection

```bash
curl -X POST http://localhost:8080/approov/disable
curl -X POST http://localhost:8080/approov/enable
curl -X GET  http://localhost:8080/approov-state
```

To disable only token binding:

```bash
curl -X POST http://localhost:8080/token-binding/disable
curl -X POST http://localhost:8080/token-binding/enable
```

## Copy-and-paste snippet: Approov token verification + binding

```ts
const claims = jwt.verify(token, approovSecret, { algorithms: ['HS256'], ignoreExpiration: true });
if (typeof claims !== 'object' || claims === null || !claims.exp) {
  throw new Error('Approov token invalid or missing exp');
}
if (Date.now() >= Number(claims.exp) * 1000) {
  throw new Error('Approov token expired');
}

const bindingHash = createHash('sha256').update(bindingValue, 'utf8').digest('base64');
const bindingHashBase64Url = bindingHash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
if (!claims.pay || bindingHashBase64Url !== claims.pay.replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')) {
  throw new Error('Approov token binding invalid');
}
```

## Reporting Issues

**Environments where the quickstart was tested:**
```text
* Runtime: Node.js LTS
* Framework: NestJS 11.x
* Build Tool: npm
```

If you encounter any problems while following this guide, please open an issue in the corresponding Approov quickstart repository.
