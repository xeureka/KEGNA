import { AsyncLocalStorage } from "node:async_hooks";

type ScopedDatabase = {
	execute: (...args: any[]) => any;
	select: (...args: any[]) => any;
	insert: (...args: any[]) => any;
	update: (...args: any[]) => any;
	delete: (...args: any[]) => any;
	transaction: (...args: any[]) => any;
};

const storage = new AsyncLocalStorage<ScopedDatabase>();

export function currentDatabase<T extends ScopedDatabase>(fallback: T): T {
	return (storage.getStore() as T | undefined) ?? fallback;
}

export function withDatabase<T>(
	database: ScopedDatabase,
	callback: () => Promise<T>,
): Promise<T> {
	return storage.run(database, callback);
}
