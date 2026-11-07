import { LegendList } from '@legendapp/list/react-native'
import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	type GestureResponderEvent,
	Pressable,
	StyleSheet,
	useWindowDimensions,
	View,
} from 'react-native'
import { Divider, Icon, Text, useTheme } from 'react-native-paper'
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import { CommentItem } from '@/features/comments/components/CommentItem'
import { useComments } from '@/hooks/queries/bilibili/comments'
import { usePlayerCommentsStore } from '@/hooks/stores/usePlayerCommentsStore'
import type { BilibiliCommentItem } from '@/types/apis/bilibili'
import type { ListRenderItemInfoWithExtraData } from '@/types/legendlist'
import * as Haptics from '@/utils/haptics'

interface PlayerCommentsCardProps {
	bvid?: string
	isLandscape?: boolean
}

const returnFalse = () => false

const renderCommentItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<
	BilibiliCommentItem,
	{ bvid: string; onReplyPress: (item: BilibiliCommentItem) => void }
>) => {
	if (!extraData) return null
	const { bvid, onReplyPress } = extraData
	return (
		<CommentItem
			item={item}
			bvid={bvid}
			onReplyPress={onReplyPress}
		/>
	)
}

export const PlayerCommentsCard = memo(function PlayerCommentsCard({
	bvid,
	isLandscape = false,
}: PlayerCommentsCardProps) {
	const theme = useTheme()
	const colors = theme.colors
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const { height } = useWindowDimensions()

	const isOpen = usePlayerCommentsStore((state) => state.isOpen)
	const isExpanded = usePlayerCommentsStore((state) => state.isExpanded)
	const close = usePlayerCommentsStore((state) => state.close)
	const toggleExpanded = usePlayerCommentsStore((state) => state.toggleExpanded)
	const setExpanded = usePlayerCommentsStore((state) => state.setExpanded)

	const [shouldRender, setShouldRender] = useState(isOpen)

	const cardHeight = Math.min(height * 0.52, 440)
	const fullHeight = Math.max(cardHeight, height - insets.top - 56)

	const translateY = useSharedValue(fullHeight + 100)
	const backdropOpacity = useSharedValue(0)
	const wasOpenRef = useRef(false)
	const dragStateRef = useRef({
		pageX: 0,
		pageY: 0,
		startY: 0,
		lastPageY: 0,
		lastTime: 0,
		vy: 0,
	})

	useEffect(() => {
		if (isLandscape) return
		if (isOpen) {
			setShouldRender(true)
			if (!wasOpenRef.current) {
				translateY.set(fullHeight + 60)
				backdropOpacity.set(0)
			}
			wasOpenRef.current = true
			const targetY = isExpanded ? 0 : fullHeight - cardHeight
			translateY.set(
				withTiming(targetY, {
					duration: 240,
					easing: Easing.linear,
				}),
			)
			backdropOpacity.set(
				withTiming(1, {
					duration: 220,
					easing: Easing.linear,
				}),
			)
			return
		}

		if (wasOpenRef.current) {
			wasOpenRef.current = false
			translateY.set(
				withTiming(fullHeight + 100, {
					duration: 230,
					easing: Easing.linear,
				}),
			)
			backdropOpacity.set(
				withTiming(0, {
					duration: 210,
					easing: Easing.linear,
				}),
			)
			const timer = setTimeout(() => {
				setShouldRender(false)
			}, 250)
			return () => clearTimeout(timer)
		}
		setShouldRender(false)
	}, [
		isOpen,
		isExpanded,
		isLandscape,
		fullHeight,
		cardHeight,
		translateY,
		backdropOpacity,
	])

	const handleToggleExpanded = useCallback(() => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		toggleExpanded()
	}, [toggleExpanded])

	const handleClose = useCallback(() => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		close()
	}, [close])

	// 纯 JS 线程原生 Responder 事件处理：无 GestureDetector 销毁竞态、无 Worklet 闭包异常、点击子按钮零冲突
	const handleHeaderTouchStart = useCallback(
		(e: GestureResponderEvent) => {
			dragStateRef.current = {
				pageX: e.nativeEvent.pageX,
				pageY: e.nativeEvent.pageY,
				startY: isExpanded ? 0 : fullHeight - cardHeight,
				lastPageY: e.nativeEvent.pageY,
				lastTime: e.nativeEvent.timestamp,
				vy: 0,
			}
		},
		[isExpanded, fullHeight, cardHeight],
	)

	const handleMoveShouldSetResponder = useCallback(
		(e: GestureResponderEvent) => {
			const dy = e.nativeEvent.pageY - dragStateRef.current.pageY
			const dx = e.nativeEvent.pageX - dragStateRef.current.pageX
			return Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)
		},
		[],
	)

	const handleResponderGrant = useCallback(() => {
		dragStateRef.current.startY = isExpanded ? 0 : fullHeight - cardHeight
	}, [isExpanded, fullHeight, cardHeight])

	const handleResponderMove = useCallback(
		(e: GestureResponderEvent) => {
			const state = dragStateRef.current
			const now = e.nativeEvent.timestamp
			const dt = now - state.lastTime
			if (dt > 0) {
				state.vy = (e.nativeEvent.pageY - state.lastPageY) / dt
			}
			state.lastPageY = e.nativeEvent.pageY
			state.lastTime = now

			const dy = e.nativeEvent.pageY - state.pageY
			const nextY = Math.max(0, Math.min(fullHeight + 80, state.startY + dy))
			translateY.set(nextY)
		},
		[fullHeight, translateY],
	)

	const handleResponderRelease = useCallback(
		(e: GestureResponderEvent) => {
			const state = dragStateRef.current
			const dy = e.nativeEvent.pageY - state.pageY
			const vy = state.vy

			if (dy < -35 || vy < -0.45) {
				void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
				if (isExpanded) {
					translateY.set(
						withTiming(0, { duration: 180, easing: Easing.linear }),
					)
				} else {
					setExpanded(true)
				}
			} else if (dy > 40 || vy > 0.45) {
				void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
				if (isExpanded) {
					setExpanded(false)
				} else {
					close()
				}
			} else {
				const restY = isExpanded ? 0 : fullHeight - cardHeight
				translateY.set(
					withTiming(restY, { duration: 180, easing: Easing.linear }),
				)
			}
		},
		[isExpanded, fullHeight, cardHeight, translateY, setExpanded, close],
	)

	const handleResponderTerminate = useCallback(() => {
		const restY = isExpanded ? 0 : fullHeight - cardHeight
		translateY.set(withTiming(restY, { duration: 180, easing: Easing.linear }))
	}, [isExpanded, fullHeight, cardHeight, translateY])

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		refetch,
		isRefetching,
	} = useComments(bvid ?? '', 3, {
		enabled: Boolean(bvid && (isOpen || shouldRender)),
	})

	const comments = useMemo(
		() => data?.pages.flatMap((page) => page.replies ?? []) ?? [],
		[data],
	)
	const totalCount = data?.pages[0]?.cursor?.all_count

	const handleReplyPress = useCallback(
		(item: BilibiliCommentItem) => {
			if (!bvid) return
			router.push({
				pathname: '/comments/reply',
				params: { bvid, rpid: String(item.rpid) },
			})
		},
		[bvid, router],
	)

	const keyExtractor = useCallback(
		(item: BilibiliCommentItem) => String(item.rpid),
		[],
	)

	const extraData = useMemo(
		() => ({
			bvid: bvid ?? '',
			onReplyPress: handleReplyPress,
		}),
		[bvid, handleReplyPress],
	)

	const ItemSeparatorComponent = useCallback(() => <Divider />, [])

	const portraitCardStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }],
	}))

	const backdropStyle = useAnimatedStyle(() => ({
		opacity: backdropOpacity.value,
	}))

	// 横屏模式：卡片仅占据右侧播放控制区域
	if (isLandscape) {
		if (!isOpen) return null
		return (
			<View
				style={[
					styles.landscapeCard,
					{ backgroundColor: colors.elevation.level2 },
				]}
			>
				<View style={styles.header}>
					<View style={styles.titleContainer}>
						<Text
							variant='titleMedium'
							style={styles.titleText}
						>
							评论区 {totalCount !== undefined ? `(${totalCount})` : ''}
						</Text>
					</View>
					<Pressable
						style={styles.headerActionBtn}
						hitSlop={6}
						onPress={handleClose}
						accessibilityLabel='关闭评论区'
					>
						<Icon
							source='close'
							size={20}
							color={colors.onSurfaceVariant}
						/>
					</Pressable>
				</View>
				<Divider />
				<View style={styles.content}>
					{!bvid ? (
						<View style={styles.center}>
							<Text style={{ color: colors.onSurfaceVariant }}>
								当前歌曲非哔哩哔哩音源，暂无评论
							</Text>
						</View>
					) : isLoading ? (
						<View style={styles.center}>
							<ActivityIndicator
								size='small'
								color={colors.primary}
							/>
						</View>
					) : (
						<LegendList
							data={comments}
							extraData={extraData}
							keyExtractor={keyExtractor}
							renderItem={renderCommentItem}
							recycleItems
							onEndReached={() => {
								if (hasNextPage) void fetchNextPage()
							}}
							onEndReachedThreshold={0.5}
							ListFooterComponent={() =>
								isFetchingNextPage ? (
									<ActivityIndicator
										style={styles.footer}
										color={colors.primary}
									/>
								) : null
							}
							refreshing={isRefetching}
							onRefresh={refetch}
							contentContainerStyle={{ paddingBottom: 24 }}
							ItemSeparatorComponent={ItemSeparatorComponent}
						/>
					)}
				</View>
			</View>
		)
	}

	if (!isOpen && !shouldRender) {
		return null
	}

	// 竖屏模式：无嵌套 Pressable、无 UI Worklet 手势冲突，固定高度线性平移
	return (
		<View
			pointerEvents={isOpen ? 'box-none' : 'none'}
			style={styles.overlayRoot}
		>
			<Animated.View
				pointerEvents={isOpen ? 'auto' : 'none'}
				style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
			>
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={handleClose}
				/>
			</Animated.View>
			<Animated.View
				pointerEvents={isOpen ? 'auto' : 'none'}
				style={[
					styles.portraitCard,
					portraitCardStyle,
					{
						height: fullHeight,
						backgroundColor: colors.elevation.level2,
						paddingBottom: insets.bottom,
					},
				]}
			>
				<View
					style={styles.dragHandleArea}
					onTouchStart={handleHeaderTouchStart}
					onStartShouldSetResponder={returnFalse}
					onMoveShouldSetResponder={handleMoveShouldSetResponder}
					onResponderGrant={handleResponderGrant}
					onResponderMove={handleResponderMove}
					onResponderRelease={handleResponderRelease}
					onResponderTerminate={handleResponderTerminate}
				>
					<Pressable
						style={styles.pillTapArea}
						onPress={handleToggleExpanded}
					>
						<View
							style={[
								styles.dragHandlePill,
								{ backgroundColor: colors.outlineVariant },
							]}
						/>
					</Pressable>
					<View style={styles.header}>
						<Pressable
							style={styles.titleContainer}
							onPress={handleToggleExpanded}
						>
							<Text
								variant='titleMedium'
								style={styles.titleText}
							>
								评论区 {totalCount !== undefined ? `(${totalCount})` : ''}
							</Text>
						</Pressable>
						<View style={styles.headerActions}>
							<Pressable
								style={styles.headerActionBtn}
								hitSlop={6}
								onPress={handleToggleExpanded}
								accessibilityLabel={
									isExpanded ? '缩小评论区' : '拉伸完整评论区'
								}
							>
								<Icon
									source={isExpanded ? 'chevron-down' : 'chevron-up'}
									size={22}
									color={colors.onSurfaceVariant}
								/>
							</Pressable>
							<Pressable
								style={styles.headerActionBtn}
								hitSlop={6}
								onPress={handleClose}
								accessibilityLabel='关闭评论区'
							>
								<Icon
									source='close'
									size={22}
									color={colors.onSurfaceVariant}
								/>
							</Pressable>
						</View>
					</View>
				</View>
				<Divider />
				<View style={styles.content}>
					{!bvid ? (
						<View style={styles.center}>
							<Text style={{ color: colors.onSurfaceVariant }}>
								当前歌曲非哔哩哔哩音源，暂无评论
							</Text>
						</View>
					) : isLoading ? (
						<View style={styles.center}>
							<ActivityIndicator
								size='small'
								color={colors.primary}
							/>
						</View>
					) : (
						<LegendList
							data={comments}
							extraData={extraData}
							keyExtractor={keyExtractor}
							renderItem={renderCommentItem}
							recycleItems
							onEndReached={() => {
								if (hasNextPage) void fetchNextPage()
							}}
							onEndReachedThreshold={0.5}
							ListFooterComponent={() =>
								isFetchingNextPage ? (
									<ActivityIndicator
										style={styles.footer}
										color={colors.primary}
									/>
								) : null
							}
							refreshing={isRefetching}
							onRefresh={refetch}
							contentContainerStyle={{
								paddingBottom: Math.max(insets.bottom + 24, 32),
							}}
							ItemSeparatorComponent={ItemSeparatorComponent}
						/>
					)}
				</View>
			</Animated.View>
		</View>
	)
})

const styles = StyleSheet.create({
	overlayRoot: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: 90,
	},
	backdrop: {
		backgroundColor: 'rgba(0, 0, 0, 0.4)',
	},
	portraitCard: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.18,
		shadowRadius: 10,
		elevation: 16,
		overflow: 'hidden',
	},
	landscapeCard: {
		flex: 1,
		borderRadius: 20,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 8,
		overflow: 'hidden',
	},
	dragHandleArea: {
		paddingTop: 6,
	},
	pillTapArea: {
		paddingVertical: 6,
		alignItems: 'center',
	},
	dragHandlePill: {
		width: 38,
		height: 4,
		borderRadius: 2,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingLeft: 16,
		paddingRight: 10,
		paddingBottom: 8,
	},
	titleContainer: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 6,
	},
	titleText: {
		fontWeight: '600',
	},
	headerActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	headerActionBtn: {
		width: 38,
		height: 38,
		borderRadius: 19,
		alignItems: 'center',
		justifyContent: 'center',
	},
	content: {
		flex: 1,
	},
	center: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 24,
	},
	footer: {
		padding: 16,
	},
})
