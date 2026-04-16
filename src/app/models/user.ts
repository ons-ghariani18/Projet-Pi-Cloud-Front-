export interface User {
  id?: number;
  username: string;
  email: string;
  password?: string;
  tel?: string;
  roles?: Role[];
}

export interface Role {
  id?: number;
  name: string; // 'ENTREPRENEUR', 'EXPERT', 'ORGANISATEUR', 'ADMIN'
}