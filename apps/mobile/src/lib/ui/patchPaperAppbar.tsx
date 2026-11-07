import {
	Children,
	cloneElement,
	Fragment,
	isValidElement,
	type ReactElement,
	type ReactNode,
	useCallback,
	useState,
} from 'react'
import {
	type LayoutChangeEvent,
	Platform,
	type StyleProp,
	StyleSheet,
	useWindowDimensions,
	View,
	type ViewStyle,
} from 'react-native'
import {
	Appbar,
	type AppbarHeaderProps,
	type MD3Theme,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const MODE_APPBAR_HEIGHT: Record<string, number> = {
	small: 64,
	medium: 112,
	large: 152,
	'center-aligned': 64,
}

type AnyElement = ReactElement<Record<string, unknown>>

function getDisplayName(element: AnyElement): string {
	const elementType = element.type as { displayName?: string; name?: string }
	return elementType?.displayName ?? elementType?.name ?? ''
}

function flattenChildren(node: ReactNode, out: ReactNode[] = []): ReactNode[] {
	Children.forEach(node, (child) => {
		if (child === null || child === undefined || typeof child === 'boolean') {
			return
		}
		if (Array.isArray(child)) {
			flattenChildren(child, out)
			return
		}
		if (isValidElement(child) && child.type === Fragment) {
			flattenChildren((child.props as { children?: ReactNode }).children, out)
			return
		}
		out.push(child)
	})
	return out
}

function isInvisibleSpacerAction(element: AnyElement): boolean {
	if (getDisplayName(element) !== 'Appbar.Action') return false
	const flatStyle = StyleSheet.flatten(
		element.props.style as StyleProp<ViewStyle>,
	)
	return Boolean(element.props.disabled) && flatStyle?.opacity === 0
}

function PatchedAppbarHeader({
	statusBarHeight,
	style,
	dark: _dark,
	mode: modeProp,
	elevated = false,
	theme: themeOverrides,
	testID = 'appbar-header',
	children,
	...rest
}: AppbarHeaderProps) {
	const mode = modeProp ?? (Platform.OS === 'ios' ? 'center-aligned' : 'small')
	const theme = useTheme<MD3Theme>(
		themeOverrides as Parameters<typeof useTheme<MD3Theme>>[0],
	)
	const insets = useSafeAreaInsets()
	const { width: windowWidth, height: windowHeight } = useWindowDimensions()

	const flattenedStyle = (StyleSheet.flatten(style as StyleProp<ViewStyle>) ??
		{}) as ViewStyle
	const {
		height = MODE_APPBAR_HEIGHT[mode] ?? 64,
		elevation = elevated ? 2 : 0,
		backgroundColor: customBackground,
		zIndex = elevated ? 1 : 0,
		...restStyle
	} = flattenedStyle

	const borderStyles: ViewStyle = {
		...(restStyle.borderRadius !== undefined && {
			borderRadius: restStyle.borderRadius,
		}),
		...(restStyle.borderTopLeftRadius !== undefined && {
			borderTopLeftRadius: restStyle.borderTopLeftRadius,
		}),
		...(restStyle.borderTopRightRadius !== undefined && {
			borderTopRightRadius: restStyle.borderTopRightRadius,
		}),
		...(restStyle.borderBottomRightRadius !== undefined && {
			borderBottomRightRadius: restStyle.borderBottomRightRadius,
		}),
		...(restStyle.borderBottomLeftRadius !== undefined && {
			borderBottomLeftRadius: restStyle.borderBottomLeftRadius,
		}),
	}

	const backgroundColor =
		customBackground ??
		(elevated ? theme.colors.elevation.level2 : theme.colors.surface)

	const flatList = flattenChildren(children)
	const leftItems: AnyElement[] = []
	const rightItems: AnyElement[] = []
	let contentElement: AnyElement | null = null

	flatList.forEach((child, idx) => {
		if (!isValidElement(child)) return
		const el = child as AnyElement
		if (isInvisibleSpacerAction(el)) return

		const displayName = getDisplayName(el)
		const keyedEl =
			el.key !== null ? el : cloneElement(el, { key: `appbar-item-${idx}` })

		if (displayName === 'Appbar.Content') {
			contentElement = keyedEl
		} else if (
			displayName === 'Appbar.BackAction' ||
			Boolean(el.props.isLeading)
		) {
			leftItems.push(keyedEl)
		} else {
			rightItems.push(keyedEl)
		}
	})

	const [measuredLeftW, setMeasuredLeftW] = useState<number | null>(null)
	const [measuredRightW, setMeasuredRightW] = useState<number | null>(null)

	const handleLeftLayout = useCallback((e: LayoutChangeEvent) => {
		const w = Math.ceil(e.nativeEvent.layout.width)
		setMeasuredLeftW((prev) => (prev === w ? prev : w))
	}, [])

	const handleRightLayout = useCallback((e: LayoutChangeEvent) => {
		const w = Math.ceil(e.nativeEvent.layout.width)
		setMeasuredRightW((prev) => (prev === w ? prev : w))
	}, [])

	const effectiveLeftW =
		leftItems.length === 0 ? 0 : (measuredLeftW ?? leftItems.length * 48)
	const effectiveRightW =
		rightItems.length === 0 ? 0 : (measuredRightW ?? rightItems.length * 48)

	// 严格使用左/右独立安全区边距（绝不使用 Math.max(left, right)），保证横屏下左侧返回按钮始终贴左
	const padLeft = insets.left + 4
	const padRight = insets.right + 4

	const leftOccupied = padLeft + effectiveLeftW
	const rightOccupied = padRight + effectiveRightW
	const symmetricSide = Math.max(leftOccupied, rightOccupied) + 6

	const isLandscape = windowWidth > windowHeight
	const canCenterSymmetrically =
		isLandscape || windowWidth - symmetricSide * 2 >= 132

	const titleLeft = canCenterSymmetrically ? symmetricSide : leftOccupied + 6
	const titleRight = canCenterSymmetrically ? symmetricSide : rightOccupied + 6

	const renderedContent = contentElement
		? cloneElement(contentElement as AnyElement, {
				mode,
				style: [
					styles.centeredContent,
					(contentElement as AnyElement).props.style as StyleProp<ViewStyle>,
				],
				titleStyle: [
					styles.centeredTitleText,
					(contentElement as AnyElement).props.titleStyle as StyleProp<unknown>,
				],
			})
		: null

	const contentHasPress = Boolean(
		contentElement && (contentElement as AnyElement).props.onPress,
	)

	return (
		<View
			testID={`${testID}-root-layer`}
			style={[
				{
					backgroundColor,
					zIndex,
					elevation,
					paddingTop: statusBarHeight ?? insets.top,
				},
				elevation > 0 && styles.elevatedShadow,
				borderStyles,
			]}
		>
			<View
				{...rest}
				testID={testID}
				style={[
					styles.barRow,
					restStyle,
					{
						height,
						backgroundColor,
						paddingLeft: padLeft,
						paddingRight: padRight,
					},
				]}
			>
				<View
					style={styles.sideGroup}
					onLayout={handleLeftLayout}
				>
					{leftItems}
				</View>

				{renderedContent && (
					<View
						pointerEvents={contentHasPress ? 'box-none' : 'none'}
						style={[
							styles.titleOverlay,
							{
								left: titleLeft,
								right: titleRight,
							},
						]}
					>
						{renderedContent}
					</View>
				)}

				<View
					style={styles.sideGroup}
					onLayout={handleRightLayout}
				>
					{rightItems}
				</View>
			</View>
		</View>
	)
}

PatchedAppbarHeader.displayName = 'Appbar.Header'

let isPaperAppbarPatched = false

export function installPaperAppbarPatch(): void {
	if (isPaperAppbarPatched) return
	isPaperAppbarPatched = true
	;(Appbar as unknown as { Header: typeof PatchedAppbarHeader }).Header =
		PatchedAppbarHeader
}

const styles = StyleSheet.create({
	barRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		position: 'relative',
	},
	sideGroup: {
		flexDirection: 'row',
		alignItems: 'center',
		zIndex: 2,
	},
	titleOverlay: {
		position: 'absolute',
		top: 0,
		bottom: 0,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 1,
	},
	centeredContent: {
		flex: 0,
		width: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 0,
		marginLeft: 0,
	},
	centeredTitleText: {
		textAlign: 'center',
	},
	elevatedShadow: {
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.15,
		shadowRadius: 3,
	},
})
