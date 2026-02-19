declare module 'electron-store' {
  interface StoreOptions<T> {
    name?: string
    defaults?: T
    [key: string]: any
  }

  class Store<T> {
    constructor(options?: StoreOptions<T>)
    store: T
    get<K extends keyof T>(key: K): T[K]
    get(): T
    set<K extends keyof T>(key: K, value: T[K]): void
    set(values: Partial<T>): void
    delete(key: keyof T): void
    clear(): void
  }

  export = Store
}
