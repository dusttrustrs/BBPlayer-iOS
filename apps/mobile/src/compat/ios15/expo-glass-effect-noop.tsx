import type { ReactNode } from 'react'
import { View, type ViewProps } from 'react-native'

export interface GlassViewProps extends ViewProps {
	glassEffectStyle?: unknown
	isInteractive?: boolean
	tintColor?: string
	colorScheme?: 'auto' | 'light' | 'dark'
	children?: ReactNode
}

export interface GlassContainerProps extends ViewProps {
	spacing?: number
	children?: ReactNode
}

export function GlassView({
	children,
	style,
	glassEffectStyle: _glassEffectStyle,
	isInteractive: _isInteractive,
	tintColor: _tintColor,
	colorScheme: _colorScheme,
	...rest
}: GlassViewProps) {
	return (
		<View
			style={style}
			{...rest}
		>
			{children}
		</View>
	)
}

export function GlassContainer({
	children,
	style,
	spacing: _spacing,
	...rest
}: GlassContainerProps) {
	return (
		<View
			style={style}
			{...rest}
		>
			{children}
		</View>
	)
}

export function isLiquidGlassAvailable(): boolean {
	return false
}

export function isGlassEffectAPIAvailable(): boolean {
	return false
}

export default {
	GlassView,
	GlassContainer,
	isLiquidGlassAvailable,
	isGlassEffectAPIAvailable,
}
