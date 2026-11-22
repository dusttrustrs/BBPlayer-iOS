import type { ReactNode } from 'react'
import {
	Pressable,
	Switch as RNSwitch,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from 'react-native'
import { Icon as PaperIcon, useTheme } from 'react-native-paper'

import { resolveSfSymbolToMdi } from './sfSymbols'

export type HostProps = {
	children?: ReactNode
	style?: StyleProp<ViewStyle>
	matchContents?: boolean | { vertical?: boolean; horizontal?: boolean }
	colorScheme?: 'light' | 'dark'
	useViewportSizeMeasurement?: boolean
	testID?: string
}

export function Host({ children, style, testID }: HostProps) {
	return (
		<View
			style={style}
			testID={testID}
		>
			{children}
		</View>
	)
}

export type SwitchProps = {
	value: boolean
	onValueChange?: (value: boolean) => void
	disabled?: boolean
	color?: string
	testID?: string
	style?: StyleProp<ViewStyle>
}

export function Switch({
	value,
	onValueChange,
	disabled,
	color,
	testID,
	style,
}: SwitchProps) {
	const { colors } = useTheme()
	return (
		<RNSwitch
			value={value}
			onValueChange={onValueChange}
			disabled={disabled}
			trackColor={{
				false: colors.surfaceVariant,
				true: color ?? colors.primary,
			}}
			testID={testID}
			style={style}
		/>
	)
}

export type CheckboxProps = {
	value: boolean
	onValueChange?: (value: boolean) => void
	disabled?: boolean
	color?: string
	testID?: string
	style?: StyleProp<ViewStyle>
}

export function Checkbox({
	value,
	onValueChange,
	disabled,
	color,
	testID,
	style,
}: CheckboxProps) {
	const { colors } = useTheme()
	const activeColor = color ?? colors.primary
	const inactiveColor = disabled
		? colors.onSurfaceDisabled
		: colors.onSurfaceVariant

	return (
		<Pressable
			accessibilityRole='checkbox'
			accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
			disabled={disabled}
			hitSlop={8}
			onPress={() => onValueChange?.(!value)}
			style={[styles.checkboxContainer, style]}
			testID={testID}
		>
			<PaperIcon
				source={value ? 'checkbox-marked' : 'checkbox-blank-outline'}
				size={24}
				color={
					disabled
						? colors.onSurfaceDisabled
						: value
							? activeColor
							: inactiveColor
				}
			/>
		</Pressable>
	)
}

export type IconProps = {
	name?: string
	source?: unknown
	size?: number
	color?: string
}

type IconSelectSpec<T = string> = {
	ios?: T
	android?: unknown
	default?: T
}

function IconComponent({ name, source, size = 20, color }: IconProps) {
	const { colors } = useTheme()
	const resolved = resolveSfSymbolToMdi(name ?? source)
	if (!resolved) return null
	return (
		<PaperIcon
			source={resolved}
			size={size}
			color={color ?? colors.onSurface}
		/>
	)
}

IconComponent.select = function selectIcon<T = string>(
	spec: IconSelectSpec<T>,
): T | undefined {
	return spec.ios ?? spec.default
}

export const Icon = IconComponent

const styles = StyleSheet.create({
	checkboxContainer: {
		width: 32,
		height: 32,
		alignItems: 'center',
		justifyContent: 'center',
	},
})
