import { Icon as ExpoIcon } from '@expo/ui'
import { LinearGradient } from 'expo-linear-gradient'
import { memo } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Icon, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MenuView } from '@/components/common/FunctionalMenu'
import { MainPlaybackControls } from '@/features/player/components/controls/PlayerControlContent'
import { PlayerSlider } from '@/features/player/components/main/PlayerSlider'
import useAppStore from '@/hooks/stores/useAppStore'
import { type MenuBuilder, useMenuActions } from '@/hooks/ui/useMenuActions'

const ALPHABETICAL_ICON = ExpoIcon.select({
	ios: 'abc',
	android: import('@expo/material-symbols/abc.xml'),
})

const TRANSLATE_ICON = ExpoIcon.select({
	ios: 'translate',
	android: import('@expo/material-symbols/translate.xml'),
})

const EDIT_ICON = ExpoIcon.select({
	ios: 'pencil',
	android: import('@expo/material-symbols/edit.xml'),
})

const OFFSET_ICON = ExpoIcon.select({
	ios: 'arrow.up.arrow.down.circle',
	android: import('@expo/material-symbols/swap_vertical_circle.xml'),
})

export const LYRICS_CONTROLS_OVERLAY_HEIGHT = 220

interface LyricsControlOverlayProps {
	offsetMenuVisible: boolean
	showTranslationToggle: boolean
	translationType: 'translation' | 'romaji'
	onToggleTranslation: () => void
	onEditLyrics: () => void
	onOpenOffsetMenu: () => void
}

export const LyricsControlOverlay = memo(function LyricsControlOverlay({
	offsetMenuVisible,
	showTranslationToggle,
	translationType,
	onToggleTranslation,
	onEditLyrics,
	onOpenOffsetMenu,
}: LyricsControlOverlayProps) {
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const { width, height } = useWindowDimensions()
	const isLandscape = width > height

	const isFluidBackground = useAppStore(
		(state) =>
			!state.settings.pureWhiteBackground &&
			state.settings.playerBackgroundStyle === 'fluid',
	)

	const menuActions = useMenuActions(addLyricsMenuItems)

	function addLyricsMenuItems(menu: MenuBuilder) {
		if (showTranslationToggle) {
			const isTranslation = translationType === 'translation'
			menu.add({
				title: isTranslation ? '切换罗马音' : '切换翻译',
				image: isTranslation ? ALPHABETICAL_ICON : TRANSLATE_ICON,
				onPress: onToggleTranslation,
			})
		}

		menu.add({
			title: '编辑歌词',
			image: EDIT_ICON,
			onPress: onEditLyrics,
		})
		menu.add({
			title: '时间轴偏移',
			image: OFFSET_ICON,
			onPress: onOpenOffsetMenu,
		})
	}

	// 横屏状态下彻底去除歌词界面下方的进度条与播放控制按钮
	if (isLandscape) {
		return null
	}

	const paddingBottom = Math.max(insets.bottom + 8, 16)
	const overlayHeight = 185 + paddingBottom

	return (
		<View
			style={[
				styles.overlayContainer,
				{
					height: overlayHeight,
				},
			]}
			pointerEvents='box-none'
		>
			{/* 防重叠渐变底色，确保歌词在控件后方优雅渐隐，不干扰进度条与按钮 */}
			<LinearGradient
				style={StyleSheet.absoluteFill}
				start={{ x: 0, y: 0 }}
				end={{ x: 0, y: 0.35 }}
				colors={[
					'rgba(0, 0, 0, 0)',
					isFluidBackground ? 'rgba(16, 16, 18, 0.92)' : colors.background,
				]}
				pointerEvents='none'
			/>

			<View style={[styles.playerControls, { paddingBottom }]}>
				{/* 功能按钮，位于 slider 上方右侧 */}
				<View style={styles.actionMenuRow}>
					<MenuView {...menuActions}>
						<Touchable
							androidRipple={{}}
							style={styles.actionMenuButton}
							disabled={offsetMenuVisible}
						>
							<Icon
								source='dots-vertical'
								size={20}
								color={
									offsetMenuVisible ? colors.onSurfaceDisabled : colors.primary
								}
							/>
						</Touchable>
					</MenuView>
				</View>
				<PlayerSlider />
				<View style={styles.playbackButtonsWrapper}>
					<MainPlaybackControls size='compact' />
				</View>
			</View>
		</View>
	)
})

const styles = StyleSheet.create({
	overlayContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		justifyContent: 'flex-end',
	},
	playerControls: {
		width: '100%',
		paddingTop: 10,
	},
	actionMenuRow: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		paddingHorizontal: 16,
		marginBottom: 2,
	},
	actionMenuButton: {
		borderRadius: 99999,
		padding: 8,
	},
	playbackButtonsWrapper: {
		marginTop: 4,
	},
})
