// iOS 15.0+ compatibility shim for react-native's NativeImageLoaderIOS.
// Avoids eager TurboModuleRegistry.getEnforcing('ImageLoader') during module evaluation
// of react-native/Libraries/Image/Image.ios.js, which otherwise breaks module loading
// of <Image> / <Animated.Image> if ImageLoader cannot be resolved eagerly.

export interface Spec {
	getConstants: () => Record<string, never>
	getSize: (uri: string) => Promise<readonly number[]>
	getSizeWithHeaders: (
		uri: string,
		headers: Record<string, string>,
	) => Promise<{ width: number; height: number }>
	prefetchImage: (uri: string) => Promise<boolean>
	prefetchImageWithMetadata?: (
		uri: string,
		queryRootName: string,
		rootTag: number,
	) => Promise<boolean>
	queryCache: (uris: string[]) => Promise<Record<string, string>>
}

let cachedLoader: Spec | null | undefined

function getImageLoader(): Spec | null {
	if (cachedLoader !== undefined) {
		return cachedLoader
	}
	try {
		const g = globalThis as Record<string, unknown>
		const proxy = g['__turboModuleProxy'] as
			| ((name: string) => Spec | null | undefined)
			| undefined
		cachedLoader = proxy?.('ImageLoader') ?? null
	} catch {
		cachedLoader = null
	}
	return cachedLoader
}

const NativeImageLoaderIOS: Spec = {
	getConstants: () => getImageLoader()?.getConstants?.() ?? {},
	getSize: (uri: string) => {
		const loader = getImageLoader()
		if (loader?.getSize) {
			return loader.getSize(uri)
		}
		return Promise.reject(
			new Error('ImageLoader TurboModule is unavailable on this device'),
		)
	},
	getSizeWithHeaders: (uri: string, headers: Record<string, string>) => {
		const loader = getImageLoader()
		if (loader?.getSizeWithHeaders) {
			return loader.getSizeWithHeaders(uri, headers)
		}
		return Promise.reject(
			new Error('ImageLoader TurboModule is unavailable on this device'),
		)
	},
	prefetchImage: (uri: string) => {
		const loader = getImageLoader()
		if (loader?.prefetchImage) {
			return loader.prefetchImage(uri)
		}
		return Promise.resolve(false)
	},
	prefetchImageWithMetadata: (
		uri: string,
		queryRootName: string,
		rootTag: number,
	) => {
		const loader = getImageLoader()
		if (loader?.prefetchImageWithMetadata) {
			return loader.prefetchImageWithMetadata(uri, queryRootName, rootTag)
		}
		if (loader?.prefetchImage) {
			return loader.prefetchImage(uri)
		}
		return Promise.resolve(false)
	},
	queryCache: (uris: string[]) => {
		const loader = getImageLoader()
		if (loader?.queryCache) {
			return loader.queryCache(uris)
		}
		return Promise.resolve({})
	},
}

export default NativeImageLoaderIOS
