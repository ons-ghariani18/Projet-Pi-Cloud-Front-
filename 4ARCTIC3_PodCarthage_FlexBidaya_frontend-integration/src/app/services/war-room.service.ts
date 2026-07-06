
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WarRoomTask } from '../models/war-room-task';
import { WarRoom } from '../models/war-room';

@Injectable({ providedIn: 'root' })
export class WarRoomService {

  private base = 'http://localhost:8080/api/war-room';

  constructor(private http: HttpClient) {}

  createWarRoom(registrationId: number): Observable<any> {
    return this.http.post(`${this.base}/create/${registrationId}`, {});
  }

  getWarRoom(registrationId: number): Observable<any> {
    return this.http.get(`${this.base}/${registrationId}`);
  }

  inviteMembers(warRoomId: number, emails: string[]): Observable<any> {
    return this.http.post(`${this.base}/${warRoomId}/invite`, { emails });
  }

  /*joinRoom(token: string, email: string): Observable<any> {
    return this.http.get(`${this.base}/join`, { params: { token, email } });
  }*/
 joinRoom(token: string): Observable<any> {
  return this.http.post(`${this.base}/join`, { token });
}

 getInvitations(email: string): Observable<WarRoom[]> {
  return this.http.get<WarRoom[]>(
    `${this.base}/invitations?email=${encodeURIComponent(email)}`
  );
}
getAcceptedInvitations(email: string): Observable<any[]> {
  return this.http.get<any[]>(
    `${this.base}/invitations/accepted?email=${encodeURIComponent(email)}`
  );
}
 addTask(warRoomId: number, task: WarRoomTask): Observable<WarRoomTask> {
  return this.http.post<WarRoomTask>(`${this.base}/${warRoomId}/tasks`, task);
}

updateTaskStatus(taskId: number, status: string): Observable<WarRoomTask> {
  return this.http.put<WarRoomTask>(
    `${this.base}/tasks/${taskId}/status`, { status }
  );
}

getTasks(warRoomId: number): Observable<WarRoomTask[]> {
  return this.http.get<WarRoomTask[]>(`${this.base}/${warRoomId}/tasks`);
}
  deleteTask(taskId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/tasks/${taskId}`);
  }

  saveWhiteboard(warRoomId: number, boardData: string): Observable<any> {
    return this.http.post(`${this.base}/${warRoomId}/whiteboard`, { boardData });
  }

  getWhiteboard(warRoomId: number): Observable<any> {
    return this.http.get(`${this.base}/${warRoomId}/whiteboard`);
  }
}
