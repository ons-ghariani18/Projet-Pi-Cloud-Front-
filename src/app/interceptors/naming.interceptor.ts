import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpResponse
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class NamingInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip transformation for Versioning, Merge, and Join APIs
    if (request.url.includes('/api/branches') || 
        request.url.includes('/api/merge') ||
        request.url.includes('/api/bmc/join')) {
      return next.handle(request);
    }

    // Convert Request Body: camelCase -> snake_case
    if (request.body && typeof request.body === 'object' && !(request.body instanceof FormData)) {
      const snakeCaseBody = this.toSnakeCase(request.body);
      request = request.clone({ body: snakeCaseBody });
    }

    return next.handle(request).pipe(
      map((event: HttpEvent<any>) => {
        if (event instanceof HttpResponse && event.body && typeof event.body === 'object') {
          // Convert Response Body: snake_case -> camelCase
          const camelCaseBody = this.toCamelCase(event.body);
          return event.clone({ body: camelCaseBody });
        }
        return event;
      })
    );
  }

  private toSnakeCase(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(v => this.toSnakeCase(v));
    } else if (obj !== null && obj.constructor === Object) {
      return Object.keys(obj).reduce((acc, key) => {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        acc[snakeKey] = this.toSnakeCase(obj[key]);
        return acc;
      }, {} as any);
    }
    return obj;
  }

  private toCamelCase(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(v => this.toCamelCase(v));
    } else if (obj !== null && obj.constructor === Object) {
      return Object.keys(obj).reduce((acc, key) => {
        const camelKey = key.replace(/(_\w)/g, match => match[1].toUpperCase());
        acc[camelKey] = this.toCamelCase(obj[key]);
        return acc;
      }, {} as any);
    }
    return obj;
  }
}
