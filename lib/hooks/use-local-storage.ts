"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A React hook for safe localStorage access with SSR/hydration handling.
 *
 * This hook handles the common Next.js issue where localStorage is not available
 * during server-side rendering. It returns the initial value during SSR and
 * hydrates from localStorage after the component mounts.
 *
 * @param key - The localStorage key to use
 * @param initialValue - The default value to use if no stored value exists
 * @returns A tuple of [storedValue, setValue, isHydrated]
 */
export function useLocalStorage<T>(
	key: string,
	initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
	// State to store value - starts with initialValue for SSR
	const [storedValue, setStoredValue] = useState<T>(initialValue);
	const [isHydrated, setIsHydrated] = useState(false);

	// Hydrate from localStorage after mount
	useEffect(() => {
		try {
			const item = window.localStorage.getItem(key);
			if (item !== null) {
				setStoredValue(JSON.parse(item) as T);
			}
		} catch (error) {
			console.warn(`Error reading localStorage key "${key}":`, error);
		}
		setIsHydrated(true);
	}, [key]);

	// Persist to localStorage
	const setValue = useCallback(
		(value: T | ((prev: T) => T)) => {
			try {
				// Allow value to be a function for prev state pattern
				const valueToStore =
					value instanceof Function ? value(storedValue) : value;

				setStoredValue(valueToStore);
				window.localStorage.setItem(key, JSON.stringify(valueToStore));
			} catch (error) {
				console.warn(`Error setting localStorage key "${key}":`, error);
			}
		},
		[key, storedValue]
	);

	return [storedValue, setValue, isHydrated];
}
