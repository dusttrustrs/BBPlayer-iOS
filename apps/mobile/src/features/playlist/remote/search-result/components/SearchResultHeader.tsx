import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
	BackHandler,
	type GestureResponderEvent,
	Keyboard,
	type LayoutChangeEvent,
	Platform,
	Pressable,
	StyleSheet,
	TextInput,
	View,
} from 'react-native'
import { Appbar, Icon, Text, useTheme } from 'react-native-paper'
import Animated, {
	cancelAnimation,
	Easing,
	Extrapolation,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import * as Haptics from '@/utils/haptics'

const COLLAPSED_PILL_WIDTH = 40
const EXPAND_EASING = Easing.bezier(0.16, 1, 0.3, 1)
const KNOCK_OUT_EASING = Easing.bezier(0.22, 0.04, 0.12, 1)
const COLLAPSE_EASING = Easing.bezier(0.4, 0, 0.2, 1)
const TITLE_RETURN_EASING = Easing.bezier(0.22, 1, 0.36, 1)

interface SearchResultHeaderProps {
	query: string
	selectMode: boolean
	selectedCount: number
	onExitSelectMode: () => void
	onBack: () => void
	onDoubleTap: (e: GestureResponderEvent) => void | Promise<void>
	onSubmitSearch: (nextQuery: string) => void | Promise<void>
	onBatchAdd?: () => void
	placeholder?: string
	isSubmitting?: boolean
}

export const SearchResultHeader = memo(function SearchResultHeader({
	query,
	selectMode,
	selectedCount,
	onExitSelectMode,
	onBack,
	onDoubleTap,
	onSubmitSearch,
	onBatchAdd,
	placeholder = '关键词 / b23.tv / 视频链接 / av / BV',
	isSubmitting = false,
}: SearchResultHeaderProps) {
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const inputRef = useRef<TextInput>(null)
	const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const [isSearchOpen, setIsSearchOpen] = useState(false)
	const [inputQuery, setInputQuery] = useState(query)
	const [stageWidth, setStageWidth] = useState(0)

	const stageWidthSV = useSharedValue(0)
	const expandProgress = useSharedValue(0)
	const titleKnockProgress = useSharedValue(0)

	const clearFocusTimer = useCallback(() => {
		if (focusTimerRef.current !== null) {
			clearTimeout(focusTimerRef.current)
			focusTimerRef.current = null
		}
	}, [])

	const collapseSearch = useCallback(
		(immediate = false) => {
			clearFocusTimer()
			inputRef.current?.blur()
			Keyboard.dismiss()
			setIsSearchOpen(false)
			cancelAnimation(expandProgress)
			cancelAnimation(titleKnockProgress)
			if (immediate) {
				expandProgress.set(0)
				titleKnockProgress.set(0)
			} else {
				expandProgress.set(
					withTiming(0, { duration: 310, easing: COLLAPSE_EASING }),
				)
				titleKnockProgress.set(
					withDelay(
						65,
						withTiming(0, { duration: 310, easing: TITLE_RETURN_EASING }),
					),
				)
			}
		},
		[clearFocusTimer, expandProgress, titleKnockProgress],
	)

	const openSearch = useCallback(() => {
		if (selectMode || isSearchOpen) return
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		setInputQuery(query)
		setIsSearchOpen(true)
		cancelAnimation(expandProgress)
		cancelAnimation(titleKnockProgress)
		expandProgress.set(withTiming(1, { duration: 440, easing: EXPAND_EASING }))
		titleKnockProgress.set(
			withDelay(55, withTiming(1, { duration: 360, easing: KNOCK_OUT_EASING })),
		)
		clearFocusTimer()
		focusTimerRef.current = setTimeout(() => {
			inputRef.current?.focus()
		}, 140)
	}, [
		clearFocusTimer,
		expandProgress,
		isSearchOpen,
		query,
		selectMode,
		titleKnockProgress,
	])

	useEffect(() => {
		setInputQuery(query)
		if (isSearchOpen) {
			collapseSearch(false)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only react when route query changes
	}, [query])

	useEffect(() => {
		if (selectMode && isSearchOpen) {
			collapseSearch(true)
		}
	}, [selectMode, isSearchOpen, collapseSearch])

	useEffect(() => {
		if (!isSearchOpen) return
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			collapseSearch(false)
			return true
		})
		return () => sub.remove()
	}, [isSearchOpen, collapseSearch])

	useEffect(() => {
		return () => {
			clearFocusTimer()
		}
	}, [clearFocusTimer])

	const handleStageLayout = useCallback(
		(e: LayoutChangeEvent) => {
			const w = Math.floor(e.nativeEvent.layout.width)
			if (w > 0) {
				stageWidthSV.set(w)
				setStageWidth((prev) => (prev === w ? prev : w))
			}
		},
		[stageWidthSV],
	)

	const handleBackPress = useCallback(() => {
		if (selectMode) {
			onExitSelectMode()
			return
		}
		if (isSearchOpen) {
			collapseSearch(false)
			return
		}
		onBack()
	}, [collapseSearch, isSearchOpen, onBack, onExitSelectMode, selectMode])

	const handleSubmit = useCallback(() => {
		const trimmed = inputQuery.trim()
		if (!trimmed) {
			collapseSearch(false)
			return
		}
		if (trimmed === query.trim()) {
			collapseSearch(false)
			return
		}
		collapseSearch(false)
		void onSubmitSearch(trimmed)
	}, [collapseSearch, inputQuery, onSubmitSearch, query])

	const handleClearOrClose = useCallback(() => {
		if (inputQuery.length > 0) {
			setInputQuery('')
			inputRef.current?.focus()
		} else {
			collapseSearch(false)
		}
	}, [collapseSearch, inputQuery.length])

	// 标题被向左展开的搜索框顶飞到左边并随后渐隐消失
	const titleAnimatedStyle = useAnimatedStyle(() => {
		const w = stageWidthSV.value > 0 ? stageWidthSV.value : 260
		const p = titleKnockProgress.value
		const translateX = interpolate(
			p,
			[0, 0.22, 1],
			[0, -w * 0.24, -w * 0.98],
			Extrapolation.CLAMP,
		)
		const scale = interpolate(
			p,
			[0, 0.14, 0.45, 1],
			[1, 0.95, 0.91, 0.86],
			Extrapolation.CLAMP,
		)
		const opacity = interpolate(
			p,
			[0, 0.28, 0.88, 1],
			[1, 0.96, 0.04, 0],
			Extrapolation.CLAMP,
		)
		return {
			opacity,
			transform: [{ translateX }, { scale }],
		}
	})

	// 右上角搜索按钮向左水平延展成搜索框
	const searchPillStyle = useAnimatedStyle(() => {
		const targetW =
			stageWidthSV.value > COLLAPSED_PILL_WIDTH
				? stageWidthSV.value
				: COLLAPSED_PILL_WIDTH
		const width = interpolate(
			expandProgress.value,
			[0, 1],
			[COLLAPSED_PILL_WIDTH, targetW],
			Extrapolation.CLAMP,
		)
		return {
			width,
		}
	})

	const searchBgStyle = useAnimatedStyle(() => {
		const opacity = interpolate(
			expandProgress.value,
			[0, 0.18, 1],
			[0, 1, 1],
			Extrapolation.CLAMP,
		)
		return {
			opacity,
		}
	})

	const inputAnimatedStyle = useAnimatedStyle(() => {
		const opacity = interpolate(
			expandProgress.value,
			[0, 0.3, 0.82, 1],
			[0, 0, 1, 1],
			Extrapolation.CLAMP,
		)
		return {
			opacity,
		}
	})

	const padLeft = insets.left + 4
	const padRight = insets.right + 4

	return (
		<View
			style={[
				styles.root,
				{
					backgroundColor: colors.elevation.level2,
					paddingTop: insets.top,
				},
			]}
		>
			<View
				style={[
					styles.barRow,
					{
						backgroundColor: colors.elevation.level2,
						paddingLeft: padLeft,
						paddingRight: padRight,
					},
				]}
			>
				{/* 左侧返回按钮始终固定不动 */}
				<View style={styles.backButtonSlot}>
					<Appbar.BackAction onPress={handleBackPress} />
				</View>

				{/* 中间标题与向右锚定、向左延展的搜索框共享裁剪舞台，保证飞出的标题不会遮挡返回按钮 */}
				<View
					style={styles.stage}
					onLayout={handleStageLayout}
				>
					<Animated.View
						pointerEvents={isSearchOpen ? 'none' : 'box-none'}
						style={[styles.titleLayer, titleAnimatedStyle]}
					>
						<Pressable
							style={styles.titlePressable}
							onPress={onDoubleTap}
						>
							<Text
								variant='titleLarge'
								numberOfLines={1}
								style={[styles.titleText, { color: colors.onSurface }]}
							>
								{selectMode
									? `已选择\u2009${selectedCount}\u2009首`
									: `搜索结果\u2009-\u2009${query}`}
							</Text>
						</Pressable>
					</Animated.View>

					{selectMode ? (
						<View style={styles.selectActionSlot}>
							<Appbar.Action
								icon='playlist-plus'
								onPress={onBatchAdd}
							/>
						</View>
					) : (
						<Animated.View
							style={[
								styles.searchPill,
								stageWidth > 0 ? searchPillStyle : styles.searchPillCollapsed,
							]}
						>
							<Animated.View
								pointerEvents='none'
								style={[
									StyleSheet.absoluteFill,
									styles.searchPillBg,
									{ backgroundColor: colors.surfaceVariant },
									searchBgStyle,
								]}
							/>
							<Pressable
								accessibilityRole='button'
								accessibilityLabel={isSearchOpen ? '执行搜索' : '展开搜索框'}
								style={styles.leadingIconBtn}
								onPress={isSearchOpen ? handleSubmit : openSearch}
								testID='search-result-header-search-btn'
							>
								{isSubmitting ? (
									<ActivityIndicator size={18} />
								) : (
									<Icon
										source='magnify'
										size={22}
										color={colors.onSurfaceVariant}
									/>
								)}
							</Pressable>
							<Animated.View
								pointerEvents={isSearchOpen ? 'auto' : 'none'}
								style={[styles.inputContainer, inputAnimatedStyle]}
							>
								<TextInput
									ref={inputRef}
									value={inputQuery}
									onChangeText={setInputQuery}
									onSubmitEditing={handleSubmit}
									placeholder={placeholder}
									placeholderTextColor={colors.onSurfaceVariant}
									returnKeyType='search'
									editable={isSearchOpen && !isSubmitting}
									autoCorrect={false}
									autoCapitalize='none'
									selectionColor={colors.primary}
									style={[styles.textInput, { color: colors.onSurface }]}
									testID='search-result-header-input'
								/>
								<Pressable
									accessibilityRole='button'
									accessibilityLabel={
										inputQuery.length > 0 ? '清空搜索词' : '收起搜索框'
									}
									hitSlop={8}
									style={styles.trailingIconBtn}
									onPress={handleClearOrClose}
								>
									<Icon
										source={inputQuery.length > 0 ? 'close-circle' : 'close'}
										size={18}
										color={colors.onSurfaceVariant}
									/>
								</Pressable>
							</Animated.View>
						</Animated.View>
					)}
				</View>
			</View>
		</View>
	)
})

const styles = StyleSheet.create({
	root: {
		elevation: 2,
		zIndex: 1,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.15,
		shadowRadius: 3,
	},
	barRow: {
		height: 64,
		flexDirection: 'row',
		alignItems: 'center',
	},
	backButtonSlot: {
		zIndex: 3,
		alignItems: 'center',
		justifyContent: 'center',
	},
	stage: {
		flex: 1,
		height: 48,
		marginRight: 4,
		overflow: 'hidden',
		position: 'relative',
		justifyContent: 'center',
	},
	titleLayer: {
		position: 'absolute',
		top: 0,
		bottom: 0,
		left: 0,
		right: COLLAPSED_PILL_WIDTH + 8,
		justifyContent: 'center',
		alignItems: 'center',
		zIndex: 1,
	},
	titlePressable: {
		width: '100%',
		height: '100%',
		justifyContent: 'center',
		alignItems: 'center',
	},
	titleText: {
		textAlign: 'center',
		fontSize: Platform.OS === 'ios' ? 20 : 21,
	},
	selectActionSlot: {
		position: 'absolute',
		right: 0,
		top: 0,
		bottom: 0,
		justifyContent: 'center',
		alignItems: 'center',
		zIndex: 2,
	},
	searchPill: {
		position: 'absolute',
		right: 0,
		top: 4,
		bottom: 4,
		borderRadius: 20,
		flexDirection: 'row',
		alignItems: 'center',
		overflow: 'hidden',
		zIndex: 2,
	},
	searchPillCollapsed: {
		width: COLLAPSED_PILL_WIDTH,
	},
	searchPillBg: {
		borderRadius: 20,
	},
	leadingIconBtn: {
		width: COLLAPSED_PILL_WIDTH,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
	},
	inputContainer: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		paddingRight: 4,
	},
	textInput: {
		flex: 1,
		fontSize: 15,
		paddingVertical: 0,
		paddingHorizontal: 0,
		height: 36,
	},
	trailingIconBtn: {
		width: 32,
		height: 32,
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
	},
})
