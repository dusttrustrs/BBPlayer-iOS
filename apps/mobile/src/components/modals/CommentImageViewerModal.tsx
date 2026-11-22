import * as FileSystem from 'expo-file-system/legacy'
import { Image } from 'expo-image'
import * as MediaLibrary from 'expo-media-library'
import { memo, useCallback, useState } from 'react'
import {
	Modal,
	StyleSheet,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from 'react-native'
import {
	Gesture,
	GestureDetector,
	GestureHandlerRootView,
} from 'react-native-gesture-handler'
import { Icon as PaperIcon, Text } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { useCommentImageViewerStore } from '@/hooks/stores/useCommentImageViewerStore'
import { toastAndLogError } from '@/utils/error-handling'
import { resolveBilibiliImageUrl } from '@/utils/imageUrl'
import toast from '@/utils/toast'

const SUPPORTED_ORIENTATIONS: Array<
	| 'portrait'
	| 'portrait-upside-down'
	| 'landscape'
	| 'landscape-left'
	| 'landscape-right'
> = [
	'portrait',
	'portrait-upside-down',
	'landscape',
	'landscape-left',
	'landscape-right',
]

function formatCommentImageUrl(rawSrc: string | undefined, maxSize: number) {
	if (!rawSrc) return ''
	return (
		resolveBilibiliImageUrl(rawSrc, maxSize) ??
		(rawSrc.startsWith('//')
			? `https:${rawSrc}`
			: rawSrc.replace(/^http:/, 'https:')) ??
		''
	)
}

interface PinchableImageViewProps {
	uri: string
	headers?: Record<string, string>
	hasPrev?: boolean
	hasNext?: boolean
	onSwipePrev?: () => void
	onSwipeNext?: () => void
}

const PinchableImageView = memo(function PinchableImageView({
	uri,
	headers,
	hasPrev,
	hasNext,
	onSwipePrev,
	onSwipeNext,
}: PinchableImageViewProps) {
	const { width: windowWidth, height: windowHeight } = useWindowDimensions()
	const scale = useSharedValue(1)
	const startScale = useSharedValue(1)
	const translateX = useSharedValue(0)
	const startTranslateX = useSharedValue(0)
	const translateY = useSharedValue(0)
	const startTranslateY = useSharedValue(0)
	const isPinching = useSharedValue(false)

	const pinchGesture = Gesture.Pinch()
		.onStart(() => {
			'worklet'
			isPinching.set(true)
			startScale.set(scale.value)
			startTranslateX.set(translateX.value)
			startTranslateY.set(translateY.value)
		})
		.onUpdate((e) => {
			'worklet'
			if (!e.scale || e.scale <= 0) return
			const targetScale = startScale.value * e.scale
			scale.set(Math.max(0.8, Math.min(targetScale, 5)))
		})
		.onEnd(() => {
			'worklet'
			isPinching.set(false)
			if (scale.value < 1.05) {
				scale.set(withTiming(1, { duration: 150 }))
				translateX.set(withTiming(0, { duration: 150 }))
				translateY.set(withTiming(0, { duration: 150 }))
				startScale.set(1)
				startTranslateX.set(0)
				startTranslateY.set(0)
			} else {
				const finalScale = Math.min(scale.value, 5)
				scale.set(finalScale)
				startScale.set(finalScale)
				const maxPanX = Math.max(0, (finalScale - 1) * (windowWidth * 0.5))
				const maxPanY = Math.max(0, (finalScale - 1) * (windowHeight * 0.5))
				const clampedX = Math.max(-maxPanX, Math.min(translateX.value, maxPanX))
				const clampedY = Math.max(-maxPanY, Math.min(translateY.value, maxPanY))
				translateX.set(clampedX)
				translateY.set(clampedY)
				startTranslateX.set(clampedX)
				startTranslateY.set(clampedY)
			}
		})

	const panGesture = Gesture.Pan()
		.averageTouches(true)
		.onStart(() => {
			'worklet'
			startTranslateX.set(translateX.value)
			startTranslateY.set(translateY.value)
		})
		.onUpdate((e) => {
			'worklet'
			if (isPinching.value) return
			if (scale.value > 1.05) {
				const maxPanX = Math.max(0, (scale.value - 1) * (windowWidth * 0.5))
				const maxPanY = Math.max(0, (scale.value - 1) * (windowHeight * 0.5))
				const nextX = startTranslateX.value + e.translationX
				const nextY = startTranslateY.value + e.translationY
				translateX.set(Math.max(-maxPanX, Math.min(nextX, maxPanX)))
				translateY.set(Math.max(-maxPanY, Math.min(nextY, maxPanY)))
			} else {
				translateX.set(e.translationX)
			}
		})
		.onEnd((e) => {
			'worklet'
			if (isPinching.value) return
			if (scale.value > 1.05) {
				const maxPanX = Math.max(0, (scale.value - 1) * (windowWidth * 0.5))
				const maxPanY = Math.max(0, (scale.value - 1) * (windowHeight * 0.5))
				const clampedX = Math.max(-maxPanX, Math.min(translateX.value, maxPanX))
				const clampedY = Math.max(-maxPanY, Math.min(translateY.value, maxPanY))
				translateX.set(clampedX)
				translateY.set(clampedY)
				startTranslateX.set(clampedX)
				startTranslateY.set(clampedY)
			} else {
				const SWIPE_THRESHOLD = 50
				const VELOCITY_THRESHOLD = 400
				if (
					e.translationX < -SWIPE_THRESHOLD ||
					e.velocityX < -VELOCITY_THRESHOLD
				) {
					if (hasNext && onSwipeNext) {
						translateX.set(
							withTiming(-windowWidth, { duration: 160 }, () => {
								scheduleOnRN(onSwipeNext)
							}),
						)
						return
					}
				} else if (
					e.translationX > SWIPE_THRESHOLD ||
					e.velocityX > VELOCITY_THRESHOLD
				) {
					if (hasPrev && onSwipePrev) {
						translateX.set(
							withTiming(windowWidth, { duration: 160 }, () => {
								scheduleOnRN(onSwipePrev)
							}),
						)
						return
					}
				}
				translateX.set(withTiming(0, { duration: 150 }))
				translateY.set(withTiming(0, { duration: 150 }))
				startTranslateX.set(0)
				startTranslateY.set(0)
			}
		})

	const doubleTap = Gesture.Tap()
		.numberOfTaps(2)
		.onEnd(() => {
			'worklet'
			if (scale.value > 1.2) {
				scale.set(withTiming(1, { duration: 200 }))
				translateX.set(withTiming(0, { duration: 200 }))
				translateY.set(withTiming(0, { duration: 200 }))
				startScale.set(1)
				startTranslateX.set(0)
				startTranslateY.set(0)
			} else {
				scale.set(withTiming(2.5, { duration: 200 }))
				startScale.set(2.5)
			}
		})

	const composed = Gesture.Simultaneous(pinchGesture, panGesture, doubleTap)

	const animatedStyle = useAnimatedStyle(() => {
		'worklet'
		return {
			transform: [
				{ translateX: translateX.value },
				{ translateY: translateY.value },
				{ scale: scale.value },
			],
		}
	})

	return (
		<GestureDetector gesture={composed}>
			<Animated.View style={[styles.pinchContainer, animatedStyle]}>
				<Image
					source={{ uri, headers }}
					style={styles.viewerImage}
					contentFit='contain'
					cachePolicy='disk'
				/>
			</Animated.View>
		</GestureDetector>
	)
})

export function CommentImageViewerModal() {
	const visible = useCommentImageViewerStore((state) => state.visible)
	const pictures = useCommentImageViewerStore((state) => state.pictures)
	const currentIndex = useCommentImageViewerStore((state) => state.currentIndex)
	const close = useCommentImageViewerStore((state) => state.close)
	const setCurrentIndex = useCommentImageViewerStore(
		(state) => state.setCurrentIndex,
	)

	const insets = useSafeAreaInsets()
	const { width, height } = useWindowDimensions()
	const isLandscape = width > height
	const [isSaving, setIsSaving] = useState(false)

	const handleSwipePrev = useCallback(() => {
		setCurrentIndex(currentIndex - 1)
	}, [currentIndex, setCurrentIndex])

	const handleSwipeNext = useCallback(() => {
		setCurrentIndex(currentIndex + 1)
	}, [currentIndex, setCurrentIndex])

	const handleDownload = useCallback(async () => {
		const rawSrc = pictures[currentIndex]
		const targetUrl = formatCommentImageUrl(rawSrc, 1600)
		if (!targetUrl) return

		try {
			setIsSaving(true)
			const permission = await MediaLibrary.requestPermissionsAsync()
			if (!permission.granted) {
				toast.error('需要相册访问权限才能保存图片')
				return
			}
			const filename = `bilibili_${Date.now()}.jpg`
			const fileUri = `${FileSystem.cacheDirectory}${filename}`
			const res = await FileSystem.downloadAsync(targetUrl, fileUri, {
				headers: { Referer: 'https://www.bilibili.com' },
			})
			const mediaLibAny = MediaLibrary as unknown as {
				Asset?: { create?: (uri: string) => Promise<unknown> }
				createAssetAsync?: (uri: string) => Promise<unknown>
				saveToLibraryAsync?: (uri: string) => Promise<unknown>
			}
			if (mediaLibAny.Asset && typeof mediaLibAny.Asset.create === 'function') {
				await mediaLibAny.Asset.create(res.uri)
			} else if (typeof mediaLibAny.createAssetAsync === 'function') {
				await mediaLibAny.createAssetAsync(res.uri)
			} else if (typeof mediaLibAny.saveToLibraryAsync === 'function') {
				await mediaLibAny.saveToLibraryAsync(res.uri)
			}
			toast.success('图片已成功保存到相册')
		} catch (err) {
			toastAndLogError('保存图片失败', err, 'Comments.DownloadImage')
		} finally {
			setIsSaving(false)
		}
	}, [currentIndex, pictures])

	if (!visible || pictures.length === 0) {
		return null
	}

	const currentImageUrl = formatCommentImageUrl(pictures[currentIndex], 1600)

	return (
		<Modal
			visible={visible}
			transparent
			presentationStyle='overFullScreen'
			statusBarTranslucent
			supportedOrientations={SUPPORTED_ORIENTATIONS}
			animationType='fade'
			onRequestClose={close}
		>
			<GestureHandlerRootView style={styles.root}>
				<View
					style={[
						styles.viewerModalContainer,
						{
							paddingTop: Math.max(insets.top, isLandscape ? 10 : 12),
							paddingBottom: Math.max(insets.bottom, isLandscape ? 12 : 24),
							paddingLeft: insets.left,
							paddingRight: insets.right,
						},
					]}
				>
					<View style={styles.viewerTopBar}>
						<TouchableOpacity
							hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
							onPress={close}
							accessibilityLabel='关闭图片预览'
						>
							<PaperIcon
								source='close'
								size={28}
								color='#ffffff'
							/>
						</TouchableOpacity>
						<Text style={styles.viewerPageIndicator}>
							{currentIndex + 1} / {pictures.length}
						</Text>
						<View style={styles.topBarSpacer} />
					</View>

					<View style={styles.viewerImageContainer}>
						{currentImageUrl ? (
							<PinchableImageView
								key={`${currentIndex}-${currentImageUrl}`}
								uri={currentImageUrl}
								headers={{ Referer: 'https://www.bilibili.com' }}
								hasPrev={currentIndex > 0}
								hasNext={currentIndex < pictures.length - 1}
								onSwipePrev={handleSwipePrev}
								onSwipeNext={handleSwipeNext}
							/>
						) : null}
					</View>

					<View
						style={[
							styles.viewerBottomBar,
							isLandscape && styles.viewerBottomBarLandscape,
						]}
					>
						<TouchableOpacity
							style={styles.downloadButton}
							disabled={isSaving}
							onPress={() => void handleDownload()}
						>
							<PaperIcon
								source='download'
								size={20}
								color='#ffffff'
							/>
							<Text style={styles.downloadButtonText}>
								{isSaving ? '正在保存...' : '下载图片'}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</GestureHandlerRootView>
		</Modal>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	pinchContainer: {
		width: '100%',
		height: '100%',
		justifyContent: 'center',
		alignItems: 'center',
	},
	viewerModalContainer: {
		flex: 1,
		backgroundColor: '#000000',
		justifyContent: 'space-between',
	},
	viewerTopBar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 8,
		zIndex: 10,
	},
	topBarSpacer: {
		width: 28,
	},
	viewerPageIndicator: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '600',
	},
	viewerImageContainer: {
		flex: 1,
		width: '100%',
		justifyContent: 'center',
		alignItems: 'center',
		position: 'relative',
	},
	viewerImage: {
		width: '100%',
		height: '100%',
	},
	viewerBottomBar: {
		paddingBottom: 12,
		paddingTop: 12,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 10,
	},
	viewerBottomBarLandscape: {
		paddingTop: 6,
		paddingBottom: 6,
	},
	downloadButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(255, 255, 255, 0.25)',
		paddingVertical: 10,
		paddingHorizontal: 24,
		borderRadius: 24,
		gap: 8,
	},
	downloadButtonText: {
		color: '#ffffff',
		fontSize: 15,
		fontWeight: '600',
	},
})
