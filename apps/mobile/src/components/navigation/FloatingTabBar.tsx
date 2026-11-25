import type { BottomTabBarProps } from '@bottom-tabs/react-navigation'
import Icon from '@react-native-vector-icons/material-design-icons'
import Color from 'color'
import { Image } from 'expo-image'
import { CommonActions } from 'expo-router/react-navigation'
import { useEffect } from 'react'
import {
	Pressable,
	StyleSheet,
	useColorScheme,
	useWindowDimensions,
	View,
} from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import useAppStore from '@/hooks/stores/useAppStore'
import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import * as Haptics from '@/utils/haptics'

const PILL_HEIGHT = 60
const PILL_INNER_PADDING = 5

const TAB_FALLBACK_META: Record<
	string,
	{
		label: string
		activeIcon: 'magnify' | 'bookshelf' | 'account'
		inactiveIcon: 'magnify' | 'bookshelf' | 'account-outline'
		skinSlot: 'home' | 'library' | 'settings'
	}
> = {
	index: {
		label: '搜索',
		activeIcon: 'magnify',
		inactiveIcon: 'magnify',
		skinSlot: 'home',
	},
	'library/[tab]': {
		label: '音乐库',
		activeIcon: 'bookshelf',
		inactiveIcon: 'bookshelf',
		skinSlot: 'library',
	},
	my: {
		label: '我的',
		activeIcon: 'account',
		inactiveIcon: 'account-outline',
		skinSlot: 'settings',
	},
}

/**
 * 悬浮胶囊底栏（参考 BiliMusic BmDock 与 PiliPlus 悬浮底栏设计）：
 * - 独立悬浮圆角胶囊，居中适配手机与 iPad / 横屏宽度
 * - 内置弹性滑块指示器（Reanimated Spring）随当前选中页平滑滑移
 * - 兼容深浅色、纯白墨水屏模式、动态主题色以及自定义装扮图标
 */
export function FloatingTabBar({
	state,
	descriptors,
	navigation,
}: BottomTabBarProps) {
	const { colors } = useTheme()
	const isDark = useColorScheme() === 'dark'
	const insets = useSafeAreaInsets()
	const { width: windowWidth } = useWindowDimensions()

	const pureWhiteBackground = useAppStore((s) => s.settings.pureWhiteBackground)
	const activeSkin = useActiveSkin()
	const activeSkinIndex = useSkinStore((s) => s.activeSkinIndex)
	const skinIcons = activeSkin?.skins[activeSkinIndex]?.tabBar.icons
	const useSkinTabs = Boolean(
		skinIcons?.home.default &&
		skinIcons.home.selected &&
		skinIcons.library.default &&
		skinIcons.library.selected &&
		skinIcons.settings.default &&
		skinIcons.settings.selected,
	)

	const visibleRoutes = state.routes.filter(
		(route) => descriptors[route.key]?.options.tabBarItemHidden !== true,
	)
	const tabCount = Math.max(visibleRoutes.length, 1)
	const activeVisibleIndex = Math.max(
		0,
		visibleRoutes.findIndex(
			(route) => route.key === state.routes[state.index]?.key,
		),
	)

	const availWidth = Math.max(260, windowWidth - insets.left - insets.right)
	const pillWidth =
		availWidth >= 500
			? Math.min(availWidth - 64, 348)
			: Math.min(Math.max(availWidth - 44, 256), 336)
	const innerWidth = pillWidth - PILL_INNER_PADDING * 2
	const slotWidth = innerWidth / tabCount

	const indicatorX = useSharedValue(activeVisibleIndex * slotWidth)

	useEffect(() => {
		indicatorX.set(
			withSpring(activeVisibleIndex * slotWidth, {
				damping: 20,
				stiffness: 260,
				mass: 0.85,
			}),
		)
	}, [activeVisibleIndex, slotWidth, indicatorX])

	const indicatorStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: indicatorX.value }],
	}))

	const capsuleBackground = pureWhiteBackground
		? colors.background
		: Color(isDark ? colors.elevation.level3 : colors.elevation.level2)
				.alpha(isDark ? 0.94 : 0.95)
				.rgb()
				.string()
	const capsuleBorderColor = pureWhiteBackground
		? colors.outlineVariant
		: isDark
			? 'rgba(255, 255, 255, 0.14)'
			: Color(colors.outlineVariant).alpha(0.65).rgb().string()

	const lensBackground = pureWhiteBackground
		? Color(colors.primary).alpha(0.12).rgb().string()
		: Color(colors.primary)
				.alpha(isDark ? 0.22 : 0.14)
				.rgb()
				.string()
	const lensBorderColor = Color(colors.primary)
		.alpha(isDark ? 0.28 : 0.18)
		.rgb()
		.string()

	const bottomOffset = Math.max(insets.bottom, 10) + 6

	return (
		<View
			pointerEvents='box-none'
			style={[
				styles.outerWrapper,
				{
					paddingBottom: bottomOffset,
					paddingLeft: insets.left,
					paddingRight: insets.right,
				},
			]}
		>
			<View
				style={[
					styles.capsule,
					{
						width: pillWidth,
						backgroundColor: capsuleBackground,
						borderColor: capsuleBorderColor,
						shadowOpacity: pureWhiteBackground ? 0.08 : isDark ? 0.36 : 0.14,
					},
				]}
				accessibilityRole='tablist'
				testID='floating-tab-bar'
			>
				{/* 弹性滑块激活指示胶囊（参考 BiliMusic _DockLens） */}
				<Animated.View
					pointerEvents='none'
					style={[
						styles.activeLens,
						{
							width: slotWidth,
							backgroundColor: lensBackground,
							borderColor: lensBorderColor,
						},
						indicatorStyle,
					]}
				/>

				{visibleRoutes.map((route) => {
					const options = descriptors[route.key]?.options
					const meta = TAB_FALLBACK_META[route.name]
					const label =
						options?.tabBarLabel ?? options?.title ?? meta?.label ?? route.name
					const focused = state.routes[state.index]?.key === route.key

					const skinIconUri =
						useSkinTabs && meta
							? focused
								? skinIcons?.[meta.skinSlot].selected
								: skinIcons?.[meta.skinSlot].default
							: undefined

					const tintColor = focused ? colors.primary : colors.onSurfaceVariant

					const onPress = () => {
						void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
						const event = navigation.emit({
							type: 'tabPress',
							target: route.key,
							canPreventDefault: true,
						})
						if (
							!focused &&
							!event.defaultPrevented &&
							!options?.preventsDefault
						) {
							navigation.dispatch({
								...CommonActions.navigate(route.name, route.params),
								target: state.key,
							})
						}
					}

					const onLongPress = () => {
						navigation.emit({
							type: 'tabLongPress',
							target: route.key,
						})
					}

					return (
						<Pressable
							key={route.key}
							onPress={onPress}
							onLongPress={onLongPress}
							accessibilityRole='tab'
							accessibilityState={{ selected: focused }}
							accessibilityLabel={label}
							testID={
								options?.tabBarButtonTestID ?? `floating-tab-${route.name}`
							}
							style={({ pressed }) => [
								styles.tabItem,
								{ opacity: pressed ? 0.72 : 1 },
							]}
						>
							{skinIconUri ? (
								<Image
									source={{ uri: skinIconUri }}
									style={styles.skinIcon}
									contentFit='contain'
								/>
							) : (
								<Icon
									name={
										focused
											? (meta?.activeIcon ?? 'circle')
											: (meta?.inactiveIcon ?? 'circle-outline')
									}
									size={22}
									color={tintColor}
								/>
							)}
							<Text
								numberOfLines={1}
								style={[
									styles.tabLabel,
									{
										color: tintColor,
										fontWeight: focused ? '700' : '500',
									},
								]}
							>
								{label}
							</Text>
						</Pressable>
					)
				})}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	outerWrapper: {
		width: '100%',
		alignItems: 'center',
		paddingTop: 4,
	},
	capsule: {
		height: PILL_HEIGHT,
		borderRadius: 999,
		borderWidth: 1,
		padding: PILL_INNER_PADDING,
		flexDirection: 'row',
		alignItems: 'center',
		position: 'relative',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 8,
		},
		shadowRadius: 20,
		elevation: 10,
	},
	activeLens: {
		position: 'absolute',
		top: PILL_INNER_PADDING,
		bottom: PILL_INNER_PADDING,
		left: PILL_INNER_PADDING,
		borderRadius: 999,
		borderWidth: StyleSheet.hairlineWidth,
	},
	tabItem: {
		flex: 1,
		height: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 2,
		zIndex: 1,
	},
	skinIcon: {
		width: 24,
		height: 24,
	},
	tabLabel: {
		fontSize: 11,
		lineHeight: 13,
	},
})
