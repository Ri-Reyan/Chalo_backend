declare global {
  namespace Express {
    interface User {
      id: string;
      name: string;
      email: string;
      role: string;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
