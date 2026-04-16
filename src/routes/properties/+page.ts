import { propertyStore } from '$lib/stores/propertyStore';
import { browser } from '$app/environment';
import type { PageLoad } from './$types';

// Non-blocking: kick off the fetches on the client but return immediately
// so navigation doesn't stall. The page renders its loading state while
// the store updates reactively.
export const load: PageLoad = async ({ fetch }) => {
	if (browser) {
		void propertyStore.loadListings(fetch);
		void propertyStore.loadListingNames(fetch);
	}
	return { listings: propertyStore };
};
