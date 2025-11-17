import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  Logger,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params, user } = request;
    const startTime = Date.now();

    // Log incoming request
    this.logger.debug(`[REQUEST] ${method} ${url}`, {
      params,
      query,
      body: this.sanitizeBody(body),
      userId: user?.id || 'anonymous',
      timestamp: new Date().toISOString(),
    });

    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - startTime;
        this.logger.debug(`[RESPONSE] ${method} ${url} - ${duration}ms`, {
          statusCode: context.switchToHttp().getResponse().statusCode,
          response: this.truncateResponse(response),
          userId: user?.id || 'anonymous',
          duration,
          timestamp: new Date().toISOString(),
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error(`[ERROR] ${method} ${url} - ${duration}ms`, {
          statusCode: error.status || 500,
          message: error.message,
          error: error.response?.message || error.toString(),
          userId: user?.id || 'anonymous',
          duration,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }),
    );
  }

  /**
   * Sanitize sensitive fields in request body
   */
  private sanitizeBody(body: any): any {
    if (!body) return body;
    const sanitized = { ...body };
    const sensitiveFields = [
      'password',
      'passwordHash',
      'otp',
      'token',
      'secret',
      'apiKey',
    ];
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    return sanitized;
  }

  /**
   * Truncate large responses to keep logs readable
   * Safe JSON stringification with circular reference handling
   */
  private truncateResponse(response: any, maxLength: number = 500): any {
    if (!response) return response;

    try {
      // Use replacer to handle circular references
      const str = JSON.stringify(response, this.getCircularReplacer());
      if (str.length > maxLength) {
        return { _truncated: `Response too large (${str.length} chars)` };
      }
      return response;
    } catch (error) {
      // If serialization fails, return safe representation
      return { _serializationFailed: 'Unable to stringify response' };
    }
  }

  /**
   * Create a replacer function for JSON.stringify to handle circular references
   */
  private getCircularReplacer() {
    const seen = new WeakSet();
    return (key: string, value: any) => {
      // Skip request/response/socket related objects
      if (
        key === 'req' ||
        key === 'res' ||
        key === 'socket' ||
        key === 'connection'
      ) {
        return '[Circular Reference]';
      }

      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    };
  }
}
