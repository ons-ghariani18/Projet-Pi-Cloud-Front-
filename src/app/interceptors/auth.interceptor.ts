import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    
    // Target both absolute (localhost:8080) and relative (/api/...) requests
    const isApiUrl = request.url.startsWith('http://localhost:8080') || 
                     request.url.startsWith('/api') || 
                     !request.url.startsWith('http'); // Assume relative calls are to our backend

    // EXCLUDE Auth and Magic Link endpoints from JWT authentication
    const isPublic = request.url.includes('/api/bmc/join') || 
                     request.url.includes('/api/bmc/view') || 
                     request.url.includes('/api/bmc/propose') ||
                     request.url.includes('/api/auth/signup') ||
                     request.url.includes('/api/auth/signin') ||
                     request.url.includes('/api/invitations/verify');

    if (token && isApiUrl && !isPublic) {

      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(request);
  }



}
