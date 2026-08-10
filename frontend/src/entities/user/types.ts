export interface User {
  id: string;
  username: string;
}

export interface Credentials {
  username: string;
  password: string;
}

export type UserStatus = 'checking' | 'anonymous' | 'authenticated';
