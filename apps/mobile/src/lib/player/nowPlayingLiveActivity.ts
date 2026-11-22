/**
 * iOS 15.0+ 兼容分支（old-dev）禁用基于 ActivityKit (iOS 16.1+) 的灵动岛 / Live Activity，
 * 避免在 iOS 15 系统上因加载 ActivityKit 动态库导致启动闪退。
 */
export function initNowPlayingLiveActivity() {
	// no-op on iOS 15.0+ compatibility build
}
