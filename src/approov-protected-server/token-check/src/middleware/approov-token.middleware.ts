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

    console.debug('---> Approov Token Middleware <---')

    console.debug("HEADERS: ", req.headers)
    const approovToken = req.headers["approov-token"]

    if (!approovToken) {
      console.debug("---> ApproovTokenMiddleware: Missing Approov token")
      throw new UnauthorizedException('Unauthorized Access')
    }

    console.debug("Approov-Token: ", approovToken)

    verify(`${approovToken}`, approovSecret, { algorithms: ['HS256'] }, function(err, decoded) {

      if (err) {
        console.debug("---> ApproovTokenMiddleware: ", err)
        throw new UnauthorizedException('Unauthorized Access')
      }

      console.debug("Approov token decoded: ", decoded)

      if (!decoded["exp"]) {
        console.debug("---> ApproovTokenMiddleware: Missing the expiration claim in the Approov token.")
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
