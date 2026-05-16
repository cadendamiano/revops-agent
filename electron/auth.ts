export type Role = 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Credentials {
  password: string;
  email?: string;
}

export interface AuthVerifier {
  verify(credentials: Credentials): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
}

export class DevPasswordVerifier implements AuthVerifier {
  private readonly password: string;
  private readonly user: User = { id: 'dev', name: 'Developer', role: 'admin' };

  constructor(password = 'BILL-demo') {
    this.password = password;
  }

  async verify({ password }: Credentials): Promise<User | null> {
    if (password !== this.password) return null;
    return this.user;
  }

  async getUserById(id: string): Promise<User | null> {
    return id === this.user.id ? this.user : null;
  }
}
