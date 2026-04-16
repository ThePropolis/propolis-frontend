import { writable } from 'svelte/store';

export type ToastVariant = 'success' | 'error' | 'info';
export interface Toast {
	id: number;
	message: string;
	variant: ToastVariant;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);
	let nextId = 1;

	function push(message: string, variant: ToastVariant = 'info', durationMs = 3500) {
		const id = nextId++;
		update((list) => [...list, { id, message, variant }]);
		setTimeout(() => {
			update((list) => list.filter((t) => t.id !== id));
		}, durationMs);
		return id;
	}

	return {
		subscribe,
		success: (m: string, d?: number) => push(m, 'success', d),
		error: (m: string, d?: number) => push(m, 'error', d ?? 5000),
		info: (m: string, d?: number) => push(m, 'info', d),
		dismiss: (id: number) => update((list) => list.filter((t) => t.id !== id))
	};
}

export const toast = createToastStore();
