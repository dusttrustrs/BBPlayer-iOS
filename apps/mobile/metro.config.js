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
const { withBoostConfig } = require('react-native-boost/metro')

const sentryConfig = getSentryExpoConfig(__dirname, {
	annotateReactComponents: true,
	includeWebReplay: false,
	includeWebFeedback: false,
})

sentryConfig.resolver.unstable_enablePackageExports = true
sentryConfig.resolver.sourceExts.push('sql')

const withReanimated = wrapWithReanimatedMetroConfig(sentryConfig)

const withWorklets = getBundleModeMetroConfig(withReanimated)

const withBoost = withBoostConfig(withWorklets, {
	logLevel: 'debug',
	ignores: [
		'node_modules/**',
		'../../node_modules/**',
		path.resolve(
			__dirname,
			'../../packages/react-native-bottom-tabs/src/TabView.tsx',
		),
	],
})

const config = withRozenite(withBoost, {
	enabled: process.env.WITH_ROZENITE === 'true',
	enhanceMetroConfig: (config) =>
		withRozeniteBundleDiscoveryPlugin(withRozeniteRequireProfiler(config)),
})

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
	'expo-widgets': path.join(IOS15_COMPAT_DIR, 'expo-widgets-noop.ts'),
}
const IOS15_NOOP_PREFIXES = [
	'@expo/ui/jetpack-compose',
	'@expo/ui/swift-ui',
	'@expo/ui/',
	'expo-widgets/',
]

const prevResolveRequest = config.resolver?.resolveRequest
config.resolver = {
	...config.resolver,
	resolveRequest(context, moduleName, platform) {
		if (platform === 'ios') {
			const exactTarget = IOS15_EXACT_ALIASES[moduleName]
			if (exactTarget) {
				return {
					filePath: exactTarget,
					type: 'sourceFile',
				}
			}
			if (IOS15_NOOP_PREFIXES.some((prefix) => moduleName.startsWith(prefix))) {
				return {
					filePath: moduleName.startsWith('expo-widgets/')
						? path.join(IOS15_COMPAT_DIR, 'expo-widgets-noop.ts')
						: path.join(IOS15_COMPAT_DIR, 'expo-ui-noop.tsx'),
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

module.exports = config
