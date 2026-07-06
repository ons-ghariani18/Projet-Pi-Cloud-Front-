export interface User {

    username: string;
    email: string;
    password: string;
    roles: Array<{
      id: number;
      name: string;
    }>;

}