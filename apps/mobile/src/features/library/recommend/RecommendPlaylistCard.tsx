import { memo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Icon, Surface, Text, useTheme } from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'

interface RecommendPlaylistCardProps {
	id: string
	title: string
	subtitle: string
	badge: string
	icon: string
	coverUrl?: string
	isSelected: boolean
	onPress: () => void
}

export const RecommendPlaylistCard = memo(function RecommendPlaylistCard({
	id,
	title,
	subtitle,
	badge,
	icon,
	coverUrl,
	isSelected,
	onPress,
}: RecommendPlaylistCardProps) {
	const { colors } = useTheme()

	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.container,
				{
					opacity: pressed ? 0.8 : 1,
					transform: [{ scale: pressed ? 0.97 : 1 }],
				},
			]}
		>
			<Surface
				style={[
					styles.cardSurface,
					{
						backgroundColor: isSelected
							? colors.secondaryContainer
							: colors.surfaceVariant,
						borderColor: isSelected ? colors.primary : 'transparent',
						borderWidth: isSelected ? 1.5 : 0,
					},
				]}
				elevation={isSelected ? 2 : 0}
			>
				{/* 封面区 */}
				<View style={styles.coverWrapper}>
					{coverUrl ? (
						<CoverWithPlaceHolder
							id={id}
							cover={coverUrl}
							title={title}
							size={110}
							borderRadius={10}
						/>
					) : (
						<View
							style={[
								styles.fallbackCover,
								{ backgroundColor: colors.primaryContainer },
							]}
						>
							<Icon
								source={icon}
								size={40}
								color={colors.onPrimaryContainer}
							/>
						</View>
					)}
					{/* 徽章 */}
					<View
						style={[
							styles.badge,
							{
								backgroundColor: isSelected
									? colors.primary
									: 'rgba(0, 0, 0, 0.65)',
							},
						]}
					>
						<Text
							variant='labelSmall'
							style={[styles.badgeText, { color: colors.onPrimary }]}
						>
							{badge}
						</Text>
					</View>
				</View>

				{/* 文本区 */}
				<View style={styles.textContainer}>
					<Text
						variant='titleSmall'
						numberOfLines={1}
						style={[
							styles.title,
							{
								color: isSelected
									? colors.onSecondaryContainer
									: colors.onSurface,
								fontWeight: isSelected ? '700' : '600',
							},
						]}
					>
						{title}
					</Text>
					<Text
						variant='bodySmall'
						numberOfLines={1}
						style={[
							styles.subtitle,
							{
								color: isSelected
									? colors.onSecondaryContainer
									: colors.onSurfaceVariant,
							},
						]}
					>
						{subtitle}
					</Text>
				</View>
			</Surface>
		</Pressable>
	)
})

const styles = StyleSheet.create({
	container: {
		width: 126,
		marginRight: 10,
	},
	cardSurface: {
		borderRadius: 14,
		padding: 8,
		overflow: 'hidden',
	},
	coverWrapper: {
		width: 110,
		height: 110,
		borderRadius: 10,
		overflow: 'hidden',
		position: 'relative',
		alignSelf: 'center',
	},
	fallbackCover: {
		width: 110,
		height: 110,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
	},
	badge: {
		position: 'absolute',
		top: 6,
		right: 6,
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 6,
	},
	badgeText: {
		fontSize: 10,
		fontWeight: '600',
	},
	textContainer: {
		marginTop: 8,
		paddingHorizontal: 2,
	},
	title: {
		fontSize: 13,
		lineHeight: 18,
	},
	subtitle: {
		fontSize: 11,
		lineHeight: 16,
		marginTop: 2,
		opacity: 0.85,
	},
})
