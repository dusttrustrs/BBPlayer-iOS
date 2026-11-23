import type { ReactNode } from 'react'
import { View } from 'react-native'

const NoopComponent = ({ children }: { children?: ReactNode }) => (
	<View>{children}</View>
)

const noopModifier = () => ({})

export const Host = NoopComponent
export const Slider = NoopComponent
export const LinearWavyProgressIndicator = NoopComponent
export const HStack = NoopComponent
export const VStack = NoopComponent
export const ZStack = NoopComponent
export const Text = NoopComponent
export const Image = NoopComponent
export const Button = NoopComponent
export const Spacer = NoopComponent
export const ProgressView = NoopComponent

export const fillMaxWidth = noopModifier
export const height = noopModifier
export const padding = noopModifier
export const frame = noopModifier
export const font = noopModifier
export const foregroundStyle = noopModifier
export const cornerRadius = noopModifier
export const clipShape = noopModifier
export const lineLimit = noopModifier
export const activityBackgroundTint = noopModifier
export const widgetURL = noopModifier
export const buttonStyle = noopModifier
export const tint = noopModifier

export function getMaterialColors() {
	return null
}

export default NoopComponent
