import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from "crypto";

@Injectable()
export class ApproovTokenBindingMiddleware implements NestMiddleware {

  use(req: Request, res: Response, next: NextFunction) {

    console.debug('---> Approov Token Binding Middleware <---')

    console.debug("Approov token claims", req["approovTokenClaims"])

    if (!("pay" in req["approovTokenClaims"])) {
      console.debug("---> ApproovTokenBindingMiddleware: the `pay` claim missing in the payload")
      throw new UnauthorizedException('Unauthorized Access')
    }

    // The Approov token claims is added to the request object on a successful
    //  Approov token verification. See `verifyApproovToken()` function.
    const token_binding_claim = req["approovTokenClaims"]["pay"]

    // We use here the Authorization token, but feel free to use another header,
    // but you need to bind this header to the Approov token in the mobile app.
    const token_binding_header = req.headers['authorization']

    if (!token_binding_header) {
      console.debug("---> ApproovTokenBindingMiddleware: missing the token binding header in the request")
      throw new UnauthorizedException('Unauthorized Access')
    }

    // We need to hash and base64 encode the token binding header, because thats
    // how it was included in the Approov token on the mobile app.
    const token_binding_header_encoded = crypto.createHash('sha256').update(token_binding_header, 'utf-8').digest('base64')

    if (token_binding_claim !== token_binding_header_encoded) {
      console.debug("---> ApproovTokenBindingMiddleware: invalid token binding")
      throw new UnauthorizedException('Unauthorized Access')
    }

    next();
  }
}
