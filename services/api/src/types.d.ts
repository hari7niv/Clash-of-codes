declare module "ioredis" {
  export class Redis {
    constructor(url?: string, options?: any);
    zcard(key: string): Promise<number>;
    zrem(key: string, ...members: string[]): Promise<number>;
    del(key: string): Promise<number>;
    disconnect(): void;
  }
}
