import argon2 from "argon2";

const options = {
  type: argon2.argon2id as any,
  memoryCost: 2 ** 16,
  timeCost: 5,
  parallelism: 1,
};

export const hashPassword = async (password: string) => {
  return await argon2.hash(password, options);
};

export const verifyPassword = async (
  hashedPassword: string,
  password: string,
) => {
  return await argon2.verify(hashedPassword, password);
};
