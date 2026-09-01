// per player count bucket, discrete shapes instead of one formula
export interface BoardBucket {
	columns: number;
	panelMaxWidth: number;
	compact: boolean;
}

export function getBoardBucket(count: number): BoardBucket {
	if (count <= 2) return { columns: 2, panelMaxWidth: 420, compact: false };
	if (count === 3) return { columns: 3, panelMaxWidth: 360, compact: false };
	if (count === 4) return { columns: 2, panelMaxWidth: 380, compact: false };
	return { columns: 3, panelMaxWidth: 300, compact: true };
}