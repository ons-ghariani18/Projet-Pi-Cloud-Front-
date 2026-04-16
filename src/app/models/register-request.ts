export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  tel?: string;
  roles: string[];               // <-- array of roles
  startupDescription?: string;
  domaine?: string;
  organisation?: string;
}