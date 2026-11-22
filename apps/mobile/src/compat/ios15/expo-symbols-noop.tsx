import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons'
import type { ComponentProps, ReactNode } from 'react'
import type { ColorValue, StyleProp, ViewStyle } from 'react-native'

import { resolveSfSymbolToMdi } from './sfSymbols'

type MdiIconName = ComponentProps<typeof MaterialDesignIcons>['name']

export interface SymbolViewProps {
	name?: string
	size?: number
	tintColor?: ColorValue
	colors?: ColorValue | ColorValue[]
	style?: StyleProp<ViewStyle>
	fallback?: ReactNode
	[key: string]: unknown
}

export function SymbolView({
	name,
	size = 24,
	tintColor,
	colors,
	fallback,
}: SymbolViewProps) {
	const mdiName = name ? resolveSfSymbolToMdi(name) : undefined
	if (!mdiName) {
		return fallback ?? null
	}
	const resolvedColor =
		typeof tintColor === 'string'
			? tintColor
			: typeof colors === 'string'
				? colors
				: Array.isArray(colors) && typeof colors[0] === 'string'
					? colors[0]
					: undefined
	return (
		<MaterialDesignIcons
			name={mdiName as MdiIconName}
			size={size}
			color={resolvedColor}
		/>
	)
}

export async function unstable_getMaterialSymbolSourceAsync(
	_symbol?: unknown,
): Promise<null> {
	return null
}

export default {
	SymbolView,
	unstable_getMaterialSymbolSourceAsync,
}
