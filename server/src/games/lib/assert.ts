// throws a loud, diagnosable error when an engine invariant is violated
export function invariant(
	condition: unknown,
	message: string,
): asserts condition {
	if (!condition) throw new Error(`[Engine] Invariant violated: ${message}`);
}

// asserts array-index access is defined (for noUncheckedIndexedAccess gaps)
export function defined<T>(val: T | undefined, invariant: string): T {
	if (val === undefined)
		throw new Error(`[Engine] Invariant violated: ${invariant}`);
	return val;
}
