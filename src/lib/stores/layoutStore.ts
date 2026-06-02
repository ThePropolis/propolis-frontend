import { writable } from 'svelte/store';

/** When true, the layout collapses the sidebar and header to give max content space. */
export const compactMode = writable(false);
