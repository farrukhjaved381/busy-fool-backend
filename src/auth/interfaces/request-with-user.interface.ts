import { Request } from 'express';

export interface UserPayload {
  sub: string;
  email: string;
  role: string;
}

export interface RequestWithUser extends Request {
  user: UserPayload;
}
