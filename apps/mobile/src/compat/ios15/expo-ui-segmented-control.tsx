import {
	Pressable,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from 'react-native'
import { Text, useTheme } from 'react-native-paper'

export type NativeSegmentedControlIOSChangeEvent = {
	nativeEvent: {
		value: string
		selectedSegmentIndex: number
		target: number
	}
}

export type SegmentedControlProps = {
	values?: string[]
	selectedIndex?: number
	onChange?: (event: NativeSegmentedControlIOSChangeEvent) => void
	onValueChange?: (value: string) => void
	enabled?: boolean
	tintColor?: string
	backgroundColor?: string
	style?: StyleProp<ViewStyle>
	testID?: string
}

const EMPTY_VALUES: string[] = []

export function SegmentedControl({
	values = EMPTY_VALUES,
	selectedIndex = 0,
	onChange,
	onValueChange,
	enabled = true,
	tintColor,
	backgroundColor,
	style,
	testID,
}: SegmentedControlProps) {
	const { colors } = useTheme()

	return (
		<View
			style={[
				styles.container,
				{
					backgroundColor: backgroundColor ?? colors.surfaceVariant,
					opacity: enabled ? 1 : 0.5,
				},
				style,
			]}
			testID={testID}
		>
			{values.map((label, index) => {
				const isSelected = index === selectedIndex
				return (
					<Pressable
						key={label}
						accessibilityRole='tab'
						accessibilityState={{ selected: isSelected, disabled: !enabled }}
						disabled={!enabled}
						onPress={() => {
							if (!enabled) return
							onChange?.({
								nativeEvent: {
									value: label,
									selectedSegmentIndex: index,
									target: 0,
								},
							})
							onValueChange?.(label)
						}}
						style={[
							styles.segment,
							isSelected && [
								styles.selectedSegment,
								{
									backgroundColor: tintColor ?? colors.elevation.level2,
								},
							],
						]}
					>
						<Text
							variant='labelLarge'
							numberOfLines={1}
							style={{
								color: isSelected ? colors.primary : colors.onSurfaceVariant,
								fontWeight: isSelected ? '600' : '400',
							}}
						>
							{label}
						</Text>
					</Pressable>
				)
			})}
		</View>
	)
}

export default SegmentedControl

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		borderRadius: 10,
		padding: 3,
		minHeight: 36,
		alignItems: 'center',
	},
	segment: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 6,
		paddingHorizontal: 10,
		borderRadius: 8,
	},
	selectedSegment: {
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.12,
		shadowRadius: 2,
		elevation: 1,
	},
})
