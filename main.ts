import 'dotenv/config';
import 'reflect-metadata';
import { createHash } from 'crypto';
import {
  Controller,
  Get,
  Injectable,
  Logger,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
  Post,
  Req,
  RequestMethod,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

const parsedPort = Number.parseInt(process.env.HTTP_PORT ?? '8080', 10);
const HTTP_PORT = Number.isNaN(parsedPort) ? 8080 : parsedPort;
const APPROOV_HEADER = 'Approov-Token';
const AUTH_HEADER = 'Authorization';
const DIGEST_HEADER = 'Content-Digest';

const hasText = (value: string | undefined | null): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const normalizePath = (path: string): string => {
  if (!path) {
    return '/';
  }
  const trimmed = path.trim();
  if (trimmed === '/') {
    return '/';
  }
  return trimmed.replace(/\/+$/, '');
};

const decodeBase64Url = (value: string): Buffer => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
};

const toBase64Url = (value: string): string =>
  value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const normalizeBase64Url = (value: string): string => toBase64Url(value.trim());

interface ProtectedRouteConfig {
  readonly path: string;
  readonly bindingHeaders: readonly string[];
}

const PROTECTED_ROUTES: readonly ProtectedRouteConfig[] = [
  { path: '/token-check', bindingHeaders: [] },
  { path: '/token-binding', bindingHeaders: [AUTH_HEADER] },
  { path: '/token-double-binding', bindingHeaders: [AUTH_HEADER, DIGEST_HEADER] },
];

const PROTECTED_ROUTE_MAP = new Map(
  PROTECTED_ROUTES.map((route) => [route.path, route] as const),
);

interface ApproovTokenPayload extends JwtPayload {
  pay?: string;
}

interface ApproovRequest extends Request {
  approovTokenClaims?: ApproovTokenPayload;
}

@Injectable()
class ApproovService {
  private readonly logger = new Logger(ApproovService.name);
  private readonly approovSecret: Buffer;
  private approovEnabled = true;
  private tokenBindingEnabled = true;

  constructor() {
    this.approovSecret = this.loadApproovSecret();
  }

  statePayload(): Record<string, boolean> {
    return {
      approovEnabled: this.approovEnabled,
      tokenBindingEnabled: this.tokenBindingEnabled,
    };
  }

  infoPayload(details: string, extra?: Record<string, unknown>): Record<string, unknown> {
    return {
      ...this.statePayload(),
      details,
      ...(extra ?? {}),
    };
  }

  enableApproov(): Record<string, boolean> {
    this.approovEnabled = true;
    this.tokenBindingEnabled = true;
    return this.statePayload();
  }

  disableApproov(): Record<string, boolean> {
    this.approovEnabled = false;
    this.tokenBindingEnabled = false;
    return this.statePayload();
  }

  enableTokenBinding(): Record<string, boolean> {
    this.tokenBindingEnabled = true;
    return this.statePayload();
  }

  disableTokenBinding(): Record<string, boolean> {
    this.tokenBindingEnabled = false;
    return this.statePayload();
  }

  isApproovEnabled(): boolean {
    return this.approovEnabled;
  }

  isTokenBindingEnabled(): boolean {
    return this.tokenBindingEnabled;
  }

  verifyApproovToken(token: string): ApproovTokenPayload {
    const payload = jwt.verify(token, this.approovSecret, {
      algorithms: ['HS256'],
      ignoreExpiration: true,
    });

    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Approov token payload is invalid.');
    }

    this.validateExpiration(payload);

    return payload as ApproovTokenPayload;
  }

  extractBindingValue(route: ProtectedRouteConfig, request: Request): string | null {
    if (route.bindingHeaders.length === 0) {
      return '';
    }

    const values = route.bindingHeaders.map((header) => request.get(header));
    if (values.some((value) => !hasText(value))) {
      return null;
    }

    return values.join('');
  }

  isBindingValid(bindingValue: string, claims: ApproovTokenPayload): boolean {
    const expected = claims.pay;
    if (!hasText(expected)) {
      return false;
    }

    const computed = this.hashBase64Url(bindingValue);
    return normalizeBase64Url(expected) === computed;
  }

  hashBase64Url(value: string): string {
    const digest = createHash('sha256').update(value, 'utf8').digest('base64');
    return toBase64Url(digest);
  }

  private validateExpiration(payload: JwtPayload): void {
    if (payload.exp === undefined || payload.exp === null) {
      throw new Error('Approov token missing expiration.');
    }

    const expSeconds = Number(payload.exp);
    if (Number.isNaN(expSeconds)) {
      throw new Error('Approov token expiration is invalid.');
    }

    if (Date.now() >= expSeconds * 1000) {
      throw new Error('Approov token expired.');
    }
  }

  private loadApproovSecret(): Buffer {
    const rawSecret = process.env.APPROOV_BASE64URL_SECRET;

    if (!hasText(rawSecret)) {
      this.logger.error('APPROOV_BASE64URL_SECRET environment variable is not set');
      throw new Error('APPROOV_BASE64URL_SECRET environment variable is not set');
    }

    return decodeBase64Url(rawSecret.trim());
  }
}

@Injectable()
class ApproovTokenVerifierMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApproovTokenVerifierMiddleware.name);

  constructor(private readonly approovService: ApproovService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const path = normalizePath(req.path ?? req.originalUrl ?? '/');
    const routeConfig = PROTECTED_ROUTE_MAP.get(path);

    if (!routeConfig) {
      next();
      return;
    }

    if (!this.approovService.isApproovEnabled()) {
      next();
      return;
    }

    const approovToken = req.get(APPROOV_HEADER);
    if (!hasText(approovToken)) {
      this.respondUnauthorized(res);
      return;
    }

    try {
      const claims = this.approovService.verifyApproovToken(approovToken.trim());
      (req as ApproovRequest).approovTokenClaims = claims;

      if (this.approovService.isTokenBindingEnabled() && routeConfig.bindingHeaders.length > 0) {
        const bindingValue = this.approovService.extractBindingValue(routeConfig, req);
        if (!hasText(bindingValue) || !this.approovService.isBindingValid(bindingValue, claims)) {
          this.respondUnauthorized(res);
          return;
        }
      }

      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Approov verification failed: ${message}`);
      this.respondUnauthorized(res);
    }
  }

  private respondUnauthorized(res: Response): void {
    res.status(401).json({
      statusCode: 401,
      message: 'Unauthorized Access',
      error: 'Unauthorized',
    });
  }
}

@Controller()
class ApproovController {
  constructor(private readonly approovService: ApproovService) {}

  @Get('/')
  home(): Record<string, unknown> {
    return this.approovService.infoPayload(`Approov demo API is running on port ${HTTP_PORT}.`);
  }

  @Get('/approov-state')
  approovState(): Record<string, boolean> {
    return this.approovService.statePayload();
  }

  @Post('/approov/enable')
  enableApproov(): Record<string, boolean> {
    return this.approovService.enableApproov();
  }

  @Post('/approov/disable')
  disableApproov(): Record<string, boolean> {
    return this.approovService.disableApproov();
  }

  @Post('/token-binding/enable')
  enableTokenBinding(): Record<string, boolean> {
    return this.approovService.enableTokenBinding();
  }

  @Post('/token-binding/disable')
  disableTokenBinding(): Record<string, boolean> {
    return this.approovService.disableTokenBinding();
  }

  @Get('/unprotected')
  unprotected(): Record<string, unknown> {
    return this.approovService.infoPayload(
      "Unprotected endpoint '/unprotected'; no Approov checks performed.",
    );
  }

  @Get('/token-check')
  tokenCheck(): Record<string, unknown> {
    return this.approovService.infoPayload(
      "Protected endpoint '/token-check'; Approov token verified.",
    );
  }

  @Get('/token-binding')
  tokenBinding(@Req() request: Request): Record<string, unknown> {
    const authorization = request.get(AUTH_HEADER);
    return this.approovService.infoPayload(
      "Protected endpoint '/token-binding'; Approov token binding enforced.",
      { authorizationHeaderPresent: hasText(authorization) },
    );
  }

  @Get('/token-double-binding')
  tokenDoubleBinding(@Req() request: Request): Record<string, unknown> {
    const authorization = request.get(AUTH_HEADER);
    const contentDigest = request.get(DIGEST_HEADER);
    return this.approovService.infoPayload(
      "Protected endpoint '/token-double-binding'; dual token binding enforced.",
      {
        authorizationHeaderPresent: hasText(authorization),
        contentDigestHeaderPresent: hasText(contentDigest),
      },
    );
  }
}

@Module({
  controllers: [ApproovController],
  providers: [ApproovService, ApproovTokenVerifierMiddleware],
})
class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ApproovTokenVerifierMiddleware)
      .forRoutes(
        ...PROTECTED_ROUTES.map((route) => ({
          path: route.path,
          method: RequestMethod.ALL,
        })),
      );
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  await app.listen(HTTP_PORT);

  const logger = new Logger('Bootstrap');
  logger.log(`Approov server listening on http://localhost:${HTTP_PORT}`);
}

bootstrap();
