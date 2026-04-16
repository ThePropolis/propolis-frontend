import { propertyStore } from '$lib/stores/propertyStore';
import { browser } from '$app/environment';
import type { PageLoad } from './$types';

// Non-blocking: fire-and-forget on the client; page renders instantly and
// reacts to store updates.
export const load: PageLoad = async ({ fetch }) => {
	if (browser) {
		void propertyStore.loadListingNames(fetch);
	}
	return { listings: propertyStore };
};
