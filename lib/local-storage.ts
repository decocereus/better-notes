/**
 * Type-safe localStorage persistence layer.
 * Provides CRUD operations for storing data in localStorage.
 */

/**
 * Generic localStorage wrapper with type safety and CRUD operations.
 */
export class LocalStorage<T> {
	private readonly key: string;
	private readonly defaultValue: T;

	constructor(key: string, defaultValue: T) {
		this.key = key;
		this.defaultValue = defaultValue;
	}

	/**
	 * Gets the stored value, or returns the default if not found.
	 */
	get(): T {
		if (typeof window === "undefined") {
			return this.defaultValue;
		}

		try {
			const stored = localStorage.getItem(this.key);
			if (stored === null) {
				return this.defaultValue;
			}
			return JSON.parse(stored) as T;
		} catch {
			console.warn(`Error reading localStorage key "${this.key}"`);
			return this.defaultValue;
		}
	}

	/**
	 * Sets the stored value.
	 */
	set(value: T): void {
		if (typeof window === "undefined") {
			return;
		}

		try {
			localStorage.setItem(this.key, JSON.stringify(value));
		} catch (error) {
			console.warn(`Error setting localStorage key "${this.key}":`, error);
		}
	}

	/**
	 * Updates the stored value using an updater function.
	 */
	update(updater: (current: T) => T): void {
		const current = this.get();
		const updated = updater(current);
		this.set(updated);
	}

	/**
	 * Clears the stored value (resets to default).
	 */
	clear(): void {
		if (typeof window === "undefined") {
			return;
		}

		try {
			localStorage.removeItem(this.key);
		} catch (error) {
			console.warn(`Error clearing localStorage key "${this.key}":`, error);
		}
	}

	/**
	 * Checks if a value exists in storage.
	 */
	exists(): boolean {
		if (typeof window === "undefined") {
			return false;
		}

		return localStorage.getItem(this.key) !== null;
	}
}

/**
 * Specialized storage for collections with CRUD operations.
 */
export class CollectionStorage<T extends { id: string }> {
	private readonly storage: LocalStorage<T[]>;

	constructor(key: string) {
		this.storage = new LocalStorage<T[]>(key, []);
	}

	/**
	 * Gets all items in the collection.
	 */
	getAll(): T[] {
		return this.storage.get();
	}

	/**
	 * Gets a single item by ID.
	 */
	getById(id: string): T | undefined {
		return this.getAll().find((item) => item.id === id);
	}

	/**
	 * Adds a new item to the collection.
	 */
	add(item: T): void {
		this.storage.update((items) => [...items, item]);
	}

	/**
	 * Updates an existing item by ID.
	 */
	update(id: string, updates: Partial<T>): T | undefined {
		let updatedItem: T | undefined;

		this.storage.update((items) =>
			items.map((item) => {
				if (item.id === id) {
					updatedItem = { ...item, ...updates };
					return updatedItem;
				}
				return item;
			})
		);

		return updatedItem;
	}

	/**
	 * Removes an item by ID.
	 */
	remove(id: string): boolean {
		const before = this.getAll().length;
		this.storage.update((items) => items.filter((item) => item.id !== id));
		const after = this.getAll().length;
		return after < before;
	}

	/**
	 * Checks if an item exists by ID.
	 */
	exists(id: string): boolean {
		return this.getById(id) !== undefined;
	}

	/**
	 * Clears all items in the collection.
	 */
	clear(): void {
		this.storage.clear();
	}

	/**
	 * Gets the count of items in the collection.
	 */
	count(): number {
		return this.getAll().length;
	}
}

// Storage key constants
const STORAGE_KEYS = {
	PROJECTS: "betternotes:projects",
	SETTINGS: "betternotes:settings",
} as const;

// Pre-configured storage instances
import type { Project } from "@/types/project";

export const projectsStorage = new CollectionStorage<Project>(
	STORAGE_KEYS.PROJECTS
);
