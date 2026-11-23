import { Divider, List } from 'react-native-paper'

import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { lyricsQueryKeys } from '@/hooks/queries/lyrics/keys'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { queryClient } from '@/lib/config/queryClient'
import type { LyricFileData } from '@/types/player/lyrics'

import {
	HighFreqButton,
	HighFreqRow,
	PlayerDownloadButton,
	PlayerModeSwitch,
	SharedTrackActions,
	ShareSongAction,
	type PlayerMenuContentProps,
} from './PlayerMenuContent'

export interface MusicFunctionalMenuProps extends PlayerMenuContentProps {
	showLandscapeLyricsActions?: boolean
	onOpenLyricsOffset?: () => void
}

export function MusicFunctionalMenu({
	onAction: handleAction,
	showLandscapeLyricsActions = false,
	onOpenLyricsOffset,
}: MusicFunctionalMenuProps) {
	const currentTrack = useCurrentTrack()
	const openModal = useModalStore((state) => state.open)

	const handleSearchLyrics = () =>
		handleAction(() => {
			if (!currentTrack) return
			openModal('ManualSearchLyrics', {
				uniqueKey: currentTrack.uniqueKey,
				initialQuery: currentTrack.title,
			})
		})

	const handleEditLyrics = () =>
		handleAction(() => {
			if (!currentTrack) return
			const cachedLyrics = queryClient.getQueryData<LyricFileData>(
				lyricsQueryKeys.smartFetchLyrics(currentTrack.uniqueKey),
			)
			openModal('EditLyrics', {
				uniqueKey: currentTrack.uniqueKey,
				lyrics: cachedLyrics ?? {
					id: currentTrack.uniqueKey,
					updateTime: Date.now(),
					lrc: '',
				},
			})
		})

	const handleOpenOffset = () =>
		handleAction(() => {
			onOpenLyricsOffset?.()
		})

	return (
		<>
			<HighFreqRow style={{ paddingBottom: 12 }}>
				<HighFreqButton
					icon='speedometer'
					label='倍速'
					onPress={() =>
						handleAction(() => openModal('PlaybackSpeed', undefined))
					}
				/>
				<HighFreqButton
					icon='timer-outline'
					label='定时关闭'
					onPress={() => handleAction(() => openModal('SleepTimer', undefined))}
				/>
				<PlayerDownloadButton onAction={handleAction} />
			</HighFreqRow>
			{showLandscapeLyricsActions && (
				<HighFreqRow style={{ paddingBottom: 12 }}>
					<HighFreqButton
						icon='magnify'
						label='搜索歌词'
						onPress={handleSearchLyrics}
					/>
					<HighFreqButton
						icon='pencil-outline'
						label='编辑歌词'
						onPress={handleEditLyrics}
					/>
					<HighFreqButton
						icon='swap-vertical-circle-outline'
						label='时间轴偏移'
						onPress={handleOpenOffset}
					/>
				</HighFreqRow>
			)}
			<PlayerModeSwitch onAction={handleAction} />
			<Divider />
			<SharedTrackActions onAction={handleAction} />
			{!showLandscapeLyricsActions && (
				<List.Item
					title='搜索歌词'
					left={(props) => (
						<List.Icon
							{...props}
							icon='magnify'
						/>
					)}
					onPress={handleSearchLyrics}
				/>
			)}
			<List.Item
				title='分享歌词'
				left={(props) => (
					<List.Icon
						{...props}
						icon='share-variant'
					/>
				)}
				onPress={() =>
					handleAction(() => {
						if (!currentTrack) return
						openModal('LyricsSelection', undefined)
					})
				}
			/>
			<ShareSongAction onAction={handleAction} />
		</>
	)
}
