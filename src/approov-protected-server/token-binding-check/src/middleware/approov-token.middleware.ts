import { Module, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
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

    console.debug('---> Approov Middleware...')

    console.debug("HEADERS: ", req.headers)
    const approovToken = req.headers["approov-token"]

    if (!approovToken) {
      console.debug("-> Missing Approov token")
      throw new UnauthorizedException('Unauthorized Access')
    }

    console.debug("Approov-Token: ", approovToken)

    verify(`${approovToken}`, approovSecret, { algorithms: ['HS256'] }, function(err, decoded) {

      if (err) {
        console.debug("-> ERROR: ", err)
        throw new UnauthorizedException('Unauthorized Access')
      }

      console.debug("Approov token decoded: ", decoded)

      if (!decoded["exp"]) {
        console.debug("-> Missing the expiration claim in the Approov token.")
        throw new UnauthorizedException('Unauthorized Access')
      }

      req["approovTokenClaims"] = decoded;
    });

    next();
  }
}
