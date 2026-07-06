export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  jwt: string;
  id: number;
  username: string;
  email: string;
  roles: string[];
}