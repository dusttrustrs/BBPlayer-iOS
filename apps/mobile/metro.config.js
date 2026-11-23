/* oxlint-disable @typescript-eslint/no-require-imports */
const path = require('path')
const { withRozenite } = require('@rozenite/metro')
const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const {
	withRozeniteRequireProfiler,
} = require('@rozenite/require-profiler-plugin/metro')
const {
	withRozeniteBundleDiscoveryPlugin,
} = require('react-native-bundle-discovery-rozenite-plugin')
const {
	wrapWithReanimatedMetroConfig,
} = require('react-native-reanimated/metro-config')
const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode')

const sentryConfig = getSentryExpoConfig(__dirname, {
	annotateReactComponents: true,
	includeWebReplay: false,
	includeWebFeedback: false,
})

sentryConfig.resolver.unstable_enablePackageExports = true
sentryConfig.resolver.sourceExts.push('sql')

const withReanimated = wrapWithReanimatedMetroConfig(sentryConfig)

const withWorklets = getBundleModeMetroConfig(withReanimated)

// iOS 15.0+ compatibility: disable react-native-boost on old-dev.
// react-native-boost monkey-patches Metro's Graph traversal and rewrites <View>/<Text>/<Image>
// into require('react-native-boost/runtime').NativeViewWithContext, which fails on iOS 15/16
// (TypeError: Cannot read property 'NativeViewWithContext' of undefined at RootLayout).

const IOS15_COMPAT_DIR = path.resolve(__dirname, 'src/compat/ios15')
const IOS15_EXACT_ALIASES = {
	'@expo/ui': path.join(IOS15_COMPAT_DIR, 'expo-ui.tsx'),
	'@expo/ui/community/menu': path.join(IOS15_COMPAT_DIR, 'expo-ui-menu.tsx'),
	'@expo/ui/community/segmented-control': path.join(
		IOS15_COMPAT_DIR,
		'expo-ui-segmented-control.tsx',
	),
	'@expo/ui/community/slider': path.join(
		IOS15_COMPAT_DIR,
		'expo-ui-slider.tsx',
	),
	'@expo/ui/community/masked-view': path.join(
		IOS15_COMPAT_DIR,
		'masked-view-noop.ts',
	),
	'expo-widgets': path.join(IOS15_COMPAT_DIR, 'expo-widgets-noop.ts'),
	'expo-glass-effect': path.join(
		IOS15_COMPAT_DIR,
		'expo-glass-effect-noop.tsx',
	),
	'expo-symbols': path.join(IOS15_COMPAT_DIR, 'expo-symbols-noop.tsx'),
}
const IOS15_NOOP_PREFIXES = [
	'@expo/ui/jetpack-compose',
	'@expo/ui/swift-ui',
	'@expo/ui/',
	'expo-widgets/',
	'expo-glass-effect/',
	'expo-symbols/',
]

function resolveIos15PrefixTarget(moduleName) {
	if (moduleName.startsWith('expo-widgets/')) {
		return path.join(IOS15_COMPAT_DIR, 'expo-widgets-noop.ts')
	}
	if (moduleName.startsWith('expo-glass-effect/')) {
		return path.join(IOS15_COMPAT_DIR, 'expo-glass-effect-noop.tsx')
	}
	if (moduleName.startsWith('expo-symbols/')) {
		return path.join(IOS15_COMPAT_DIR, 'expo-symbols-noop.tsx')
	}
	return path.join(IOS15_COMPAT_DIR, 'expo-ui-noop.tsx')
}

function applyIos15CompatResolver(metroConfig) {
	const prevResolveRequest = metroConfig.resolver?.resolveRequest
	metroConfig.resolver = {
		...metroConfig.resolver,
		resolveRequest(context, moduleName, platform) {
			if (platform === 'ios') {
				const exactTarget = IOS15_EXACT_ALIASES[moduleName]
				if (exactTarget) {
					return {
						filePath: exactTarget,
						type: 'sourceFile',
					}
				}
				if (
					IOS15_NOOP_PREFIXES.some((prefix) => moduleName.startsWith(prefix))
				) {
					return {
						filePath: resolveIos15PrefixTarget(moduleName),
						type: 'sourceFile',
					}
				}
			}
			if (prevResolveRequest) {
				return prevResolveRequest(context, moduleName, platform)
			}
			return context.resolveRequest(context, moduleName, platform)
		},
	}
	return metroConfig
}

const rozeniteConfig = withRozenite(withWorklets, {
	enabled: process.env.WITH_ROZENITE === 'true',
	enhanceMetroConfig: (cfg) =>
		withRozeniteBundleDiscoveryPlugin(withRozeniteRequireProfiler(cfg)),
})

module.exports = async () => {
	const resolved =
		typeof rozeniteConfig === 'function'
			? await rozeniteConfig()
			: await rozeniteConfig
	return applyIos15CompatResolver(resolved)
}
