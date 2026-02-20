import 'dotenv/config';
import 'reflect-metadata';
import { createHash, timingSafeEqual } from 'crypto';
import {
  Controller,
  Get,
  Injectable,
  Logger,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
  UnauthorizedException,
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
const SESSION_ID_HEADER = 'SessionId';
const REQUIRED_SECRET_PLACEHOLDER = 'approov_base64url_secret_here';

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

const decodeBase64Url = (value: string): Buffer =>
  Buffer.from(value, 'base64url');

const normalizeBase64Url = (value: string): string =>
  value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const isValidBase64Url = (value: string): boolean => {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(trimmed)) {
    return false;
  }
  if (trimmed.length % 4 === 1) {
    return false;
  }
  const normalized = normalizeBase64Url(trimmed);
  const decoded = Buffer.from(trimmed, 'base64url');
  if (decoded.length === 0) {
    return false;
  }
  return decoded.toString('base64url') === normalized;
};

interface ProtectedRouteConfig {
  readonly path: string;
  readonly bindingHeaders: readonly string[];
}

const PROTECTED_ROUTES: readonly ProtectedRouteConfig[] = [
  { path: '/token-check', bindingHeaders: [] },
  { path: '/token-binding', bindingHeaders: [AUTH_HEADER] },
  { path: '/token-double-binding', bindingHeaders: [AUTH_HEADER, SESSION_ID_HEADER] },
];

const PROTECTED_ROUTE_MAP = new Map(
  PROTECTED_ROUTES.map((route) => [route.path, route] as const),
);

interface ApproovTokenPayload extends JwtPayload {
  pay?: string;
}

interface ApproovState {
  approovEnabled: boolean;
  tokenBindingEnabled: boolean;
}

interface ApproovRequest extends Request {
  approovTokenClaims?: ApproovTokenPayload;
  approovSummary?: string;
  approovRequiredHeaders?: string[];
  approovState?: ApproovState;
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

  statePayload(): ApproovState {
    return {
      approovEnabled: this.approovEnabled,
      tokenBindingEnabled: this.tokenBindingEnabled,
    };
  }

  requiredHeaders(route: ProtectedRouteConfig): string[] {
    if (!this.approovEnabled) {
      return [];
    }
    const headers = [APPROOV_HEADER];
    if (this.tokenBindingEnabled) {
      headers.push(...route.bindingHeaders);
    }
    return headers;
  }

  infoPayload(details: string, extra?: Record<string, unknown>): Record<string, unknown> {
    return {
      ...this.statePayload(),
      details,
      ...(extra ?? {}),
    };
  }

  enableApproov(): ApproovState {
    this.approovEnabled = true;
    this.tokenBindingEnabled = true;
    return this.statePayload();
  }

  disableApproov(): ApproovState {
    this.approovEnabled = false;
    this.tokenBindingEnabled = false;
    return this.statePayload();
  }

  enableTokenBinding(): ApproovState {
    this.tokenBindingEnabled = true;
    return this.statePayload();
  }

  disableTokenBinding(): ApproovState {
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
    });

    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Approov token payload is invalid.');
    }

    const claims = payload as ApproovTokenPayload;
    if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
      throw new Error('Approov token exp claim is missing.');
    }

    const now = Math.floor(Date.now() / 1000);
    if (claims.exp <= now) {
      throw new Error('Approov token has expired.');
    }

    return claims;
  }

  extractBindingValue(route: ProtectedRouteConfig, request: Request): string | null {
    if (route.bindingHeaders.length === 0) {
      return '';
    }

    const values: string[] = [];
    for (const header of route.bindingHeaders) {
      const value = request.get(header);
      const trimmed = typeof value === 'string' ? value.trim() : '';
      if (!hasText(trimmed)) {
        return null;
      }
      values.push(trimmed);
    }

    return values.join('');
  }

  isBindingValid(bindingValue: string, claims: ApproovTokenPayload): boolean {
    const expected = claims.pay;
    if (!hasText(expected)) {
      return false;
    }

    const computed = this.hashBase64(bindingValue);
    const trimmedExpected = expected.trim();
    if (trimmedExpected.length !== computed.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(trimmedExpected), Buffer.from(computed));
  }

  hashBase64(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('base64');
  }

  private loadApproovSecret(): Buffer {
    const rawSecret = process.env.APPROOV_BASE64URL_SECRET;
    const trimmedSecret = rawSecret?.trim();

    if (!hasText(trimmedSecret) || trimmedSecret === REQUIRED_SECRET_PLACEHOLDER) {
      this.logger.error('Required secret is not set');
      throw new Error('Required secret is not set');
    }

    if (!isValidBase64Url(trimmedSecret)) {
      this.logger.error('Approov secret is invalid');
      throw new Error('Approov secret is invalid');
    }

    return decodeBase64Url(trimmedSecret);
  }
}

@Injectable()
class HttpRequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HttpRequest');

  constructor(private readonly approovService: ApproovService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    res.on('finish', () => {
      const status = res.statusCode;
      if (status !== 200 && status !== 401) {
        return;
      }

      const request = req as ApproovRequest;
      const path = normalizePath(req.path ?? req.originalUrl ?? '/');
      const routeConfig = PROTECTED_ROUTE_MAP.get(path);
      const state = request.approovState ?? this.approovService.statePayload();
      const requiredHeaders =
        request.approovRequiredHeaders ??
        (routeConfig && state.approovEnabled
          ? this.approovService.requiredHeaders(routeConfig)
          : []);
      const summary =
        request.approovSummary ??
        (!routeConfig
          ? 'unprotected'
          : !state.approovEnabled
            ? 'approov_disabled'
            : status === 401
              ? 'approov_failed:unknown'
              : 'approov_ok');
      const ip = req.ip ?? req.socket.remoteAddress ?? '';
      const port = req.socket.localPort ?? HTTP_PORT;

      const logPayload = {
        summary,
        method: req.method,
        path,
        status,
        ip,
        port,
        approovEnabled: state.approovEnabled,
        tokenBindingEnabled: state.tokenBindingEnabled,
        required_headers: requiredHeaders,
      };

      this.logger.log(`http.request.completed ${JSON.stringify(logPayload)}`);
    });

    next();
  }
}

@Injectable()
class ApproovTokenVerifierMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApproovTokenVerifierMiddleware.name);

  constructor(private readonly approovService: ApproovService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const path = normalizePath(req.path ?? req.originalUrl ?? '/');
    const routeConfig = PROTECTED_ROUTE_MAP.get(path);
    const request = req as ApproovRequest;

    if (!routeConfig) {
      next();
      return;
    }

    request.approovState = this.approovService.statePayload();
    request.approovRequiredHeaders = this.approovService.requiredHeaders(routeConfig);

    if (!this.approovService.isApproovEnabled()) {
      request.approovSummary = 'approov_disabled';
      next();
      return;
    }

    const approovToken = req.get(APPROOV_HEADER);
    if (!hasText(approovToken)) {
      request.approovSummary = 'approov_failed:missing_approov_token';
      this.raiseUnauthorized(next);
      return;
    }

    try {
      const claims = this.approovService.verifyApproovToken(approovToken.trim());
      request.approovTokenClaims = claims;

      if (this.approovService.isTokenBindingEnabled() && routeConfig.bindingHeaders.length > 0) {
        const bindingValue = this.approovService.extractBindingValue(routeConfig, req);
        if (!hasText(bindingValue)) {
          request.approovSummary = 'approov_failed:missing_binding_header';
          this.raiseUnauthorized(next);
          return;
        }
        if (!this.approovService.isBindingValid(bindingValue, claims)) {
          request.approovSummary = 'approov_failed:binding_mismatch';
          this.raiseUnauthorized(next);
          return;
        }
      }

      request.approovSummary = 'approov_ok';
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Approov verification failed: ${message}`);
      request.approovSummary = 'approov_failed:token_verification_failed';
      this.raiseUnauthorized(next);
    }
  }

  private raiseUnauthorized(next: NextFunction): void {
    next(new UnauthorizedException('Unauthorized Access'));
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
  approovState(): ApproovState {
    return this.approovService.statePayload();
  }

  @Post('/approov/enable')
  enableApproov(): ApproovState {
    return this.approovService.enableApproov();
  }

  @Post('/approov/disable')
  disableApproov(): ApproovState {
    return this.approovService.disableApproov();
  }

  @Post('/token-binding/enable')
  enableTokenBinding(): ApproovState {
    return this.approovService.enableTokenBinding();
  }

  @Post('/token-binding/disable')
  disableTokenBinding(): ApproovState {
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
    const sessionId = request.get(SESSION_ID_HEADER);
    return this.approovService.infoPayload(
      "Protected endpoint '/token-double-binding'; dual token binding enforced.",
      {
        authorizationHeaderPresent: hasText(authorization),
        sessionIdHeaderPresent: hasText(sessionId),
      },
    );
  }
}

@Module({
  controllers: [ApproovController],
  providers: [ApproovService, ApproovTokenVerifierMiddleware, HttpRequestLoggingMiddleware],
})
class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(HttpRequestLoggingMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

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
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error'] });
  await app.listen(HTTP_PORT);

  const logger = new Logger('Bootstrap');
  logger.log(`Approov server listening on http://localhost:${HTTP_PORT}`);
}

bootstrap();
