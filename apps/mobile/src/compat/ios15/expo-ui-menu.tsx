import {
	cloneElement,
	forwardRef,
	Fragment,
	isValidElement,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react'
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
	type StyleProp,
	type ViewStyle,
} from 'react-native'
import {
	Divider,
	Icon as PaperIcon,
	Surface,
	Text,
	useTheme,
} from 'react-native-paper'

import { resolveSfSymbolToMdi } from './sfSymbols'

export type MenuState = 'on' | 'off' | 'mixed'

export type MenuAttributes = {
	disabled?: boolean
	destructive?: boolean
	hidden?: boolean
	keepsMenuPresented?: boolean
}

export type MenuAction = {
	id?: string
	title: string
	subtitle?: string
	titleColor?: string
	image?: unknown
	imageColor?: string
	state?: MenuState
	attributes?: MenuAttributes
	displayInline?: boolean
	subactions?: MenuAction[]
}

export type NativeActionEvent = {
	nativeEvent: {
		event: string
	}
}

export type MenuComponentRef = {
	show: () => void
}

export type MenuComponentProps = {
	actions: MenuAction[]
	onPressAction?: (event: NativeActionEvent) => void
	onOpenMenu?: () => void
	onCloseMenu?: () => void
	shouldOpenOnLongPress?: boolean
	title?: string
	style?: StyleProp<ViewStyle>
	themeVariant?: 'light' | 'dark'
	isAnchoredToRight?: boolean
	hitSlop?:
		| number
		| { top?: number; left?: number; bottom?: number; right?: number }
	children?: ReactNode
}

type AnchorRect = {
	x: number
	y: number
	width: number
	height: number
}

type TriggerElementProps = {
	onPress?: (...args: unknown[]) => void
	onLongPress?: (...args: unknown[]) => void
	disabled?: boolean
}

const MENU_MIN_WIDTH = 200
const MENU_MAX_WIDTH = 280
const MENU_ITEM_HEIGHT = 46
const SCREEN_MARGIN = 12

export const MenuView = forwardRef<MenuComponentRef, MenuComponentProps>(
	function MenuView(
		{
			actions,
			onPressAction,
			onOpenMenu,
			onCloseMenu,
			shouldOpenOnLongPress = false,
			title,
			style,
			children,
		},
		ref,
	) {
		const { colors } = useTheme()
		const { width: screenWidth, height: screenHeight } = useWindowDimensions()
		const anchorRef = useRef<View>(null)
		const [visible, setVisible] = useState(false)
		const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null)
		const [submenuStack, setSubmenuStack] = useState<
			{ title?: string; actions: MenuAction[] }[]
		>([])

		const currentLevel =
			submenuStack.length > 0
				? submenuStack[submenuStack.length - 1]
				: { title, actions }

		const visibleActions = useMemo(
			() =>
				(currentLevel.actions ?? []).filter(
					(action) => !action.attributes?.hidden,
				),
			[currentLevel.actions],
		)

		const closeMenu = useCallback(() => {
			setVisible(false)
			setSubmenuStack([])
			onCloseMenu?.()
		}, [onCloseMenu])

		const openMenu = useCallback(() => {
			if (!actions || actions.length === 0) return
			onOpenMenu?.()
			setSubmenuStack([])
			setVisible(true)
		}, [actions, onOpenMenu])

		useEffect(() => {
			if (!visible) return
			const node = anchorRef.current
			if (node && typeof node.measureInWindow === 'function') {
				node.measureInWindow((x, y, width, height) => {
					setAnchorRect({ x, y, width, height })
				})
			} else {
				setAnchorRect(null)
			}
		}, [visible])

		useImperativeHandle(
			ref,
			() => ({
				show: openMenu,
			}),
			[openMenu],
		)

		const handleActionPress = useCallback(
			(action: MenuAction) => {
				if (action.attributes?.disabled) return
				if (
					action.subactions &&
					action.subactions.length > 0 &&
					!action.displayInline
				) {
					setSubmenuStack((prev) => [
						...prev,
						{ title: action.title, actions: action.subactions ?? [] },
					])
					return
				}
				const keepsPresented = Boolean(action.attributes?.keepsMenuPresented)
				if (!keepsPresented) {
					closeMenu()
				}
				onPressAction?.({
					nativeEvent: {
						event: action.id ?? action.title,
					},
				})
			},
			[closeMenu, onPressAction],
		)

		const flattenedRows = useMemo(() => {
			const rows: (
				| { kind: 'action'; action: MenuAction; key: string }
				| { kind: 'divider'; key: string }
			)[] = []

			visibleActions.forEach((action, index) => {
				if (
					action.displayInline &&
					action.subactions &&
					action.subactions.length > 0
				) {
					if (rows.length > 0) {
						rows.push({ kind: 'divider', key: `div-before-${index}` })
					}
					action.subactions
						.filter((sub) => !sub.attributes?.hidden)
						.forEach((sub, subIdx) => {
							rows.push({
								kind: 'action',
								action: sub,
								key: `${sub.id ?? sub.title}-${index}-${subIdx}`,
							})
						})
					if (index < visibleActions.length - 1) {
						rows.push({ kind: 'divider', key: `div-after-${index}` })
					}
				} else {
					rows.push({
						kind: 'action',
						action,
						key: `${action.id ?? action.title}-${index}`,
					})
				}
			})

			return rows
		}, [visibleActions])

		const estimatedHeight = Math.min(
			screenHeight - SCREEN_MARGIN * 4,
			(currentLevel.title || submenuStack.length > 0 ? 40 : 0) +
				flattenedRows.length * MENU_ITEM_HEIGHT +
				16,
		)
		const menuWidth = Math.min(MENU_MAX_WIDTH, screenWidth - SCREEN_MARGIN * 2)

		const positionStyle = useMemo<ViewStyle>(() => {
			if (!anchorRect) {
				return {
					top: Math.max(SCREEN_MARGIN, (screenHeight - estimatedHeight) / 2),
					left: Math.max(SCREEN_MARGIN, (screenWidth - menuWidth) / 2),
				}
			}

			let left = anchorRect.x + anchorRect.width - menuWidth
			if (left < SCREEN_MARGIN) {
				left = anchorRect.x
			}
			left = Math.max(
				SCREEN_MARGIN,
				Math.min(left, screenWidth - menuWidth - SCREEN_MARGIN),
			)

			let top = anchorRect.y + anchorRect.height + 6
			if (top + estimatedHeight > screenHeight - SCREEN_MARGIN) {
				top = Math.max(SCREEN_MARGIN, anchorRect.y - estimatedHeight - 6)
			}

			return { top, left }
		}, [anchorRect, estimatedHeight, menuWidth, screenHeight, screenWidth])

		const triggerNode = isValidElement<TriggerElementProps>(children) ? (
			shouldOpenOnLongPress ? (
				cloneElement(children, {
					onLongPress: (...args: unknown[]) => {
						children.props.onLongPress?.(...args)
						if (!children.props.disabled) openMenu()
					},
				})
			) : (
				cloneElement(children, {
					onPress: (...args: unknown[]) => {
						children.props.onPress?.(...args)
						if (!children.props.disabled) openMenu()
					},
				})
			)
		) : (
			<Pressable
				onPress={shouldOpenOnLongPress ? undefined : openMenu}
				onLongPress={shouldOpenOnLongPress ? openMenu : undefined}
			>
				{children}
			</Pressable>
		)

		return (
			<View
				ref={anchorRef}
				collapsable={false}
				style={style}
			>
				{triggerNode}
				{visible ? (
					<Modal
						transparent
						visible={visible}
						animationType='fade'
						statusBarTranslucent
						onRequestClose={closeMenu}
					>
						<View style={styles.modalRoot}>
							<Pressable
								style={StyleSheet.absoluteFill}
								onPress={closeMenu}
							/>
							<Surface
								elevation={4}
								style={[
									styles.menuCard,
									{
										width: menuWidth,
										minWidth: MENU_MIN_WIDTH,
										maxHeight: screenHeight - SCREEN_MARGIN * 4,
										backgroundColor: colors.elevation.level3,
									},
									positionStyle,
								]}
							>
								{submenuStack.length > 0 ? (
									<>
										<Pressable
											onPress={() =>
												setSubmenuStack((prev) => prev.slice(0, -1))
											}
											style={styles.headerRow}
										>
											<Text
												variant='labelMedium'
												style={{ color: colors.primary }}
												numberOfLines={1}
											>
												‹ {currentLevel.title || '返回'}
											</Text>
										</Pressable>
										<Divider />
									</>
								) : currentLevel.title ? (
									<>
										<View style={styles.headerRow}>
											<Text
												variant='labelMedium'
												style={{ color: colors.onSurfaceVariant }}
												numberOfLines={1}
											>
												{currentLevel.title}
											</Text>
										</View>
										<Divider />
									</>
								) : null}
								<ScrollView bounces={false}>
									{flattenedRows.map((row) => {
										if (row.kind === 'divider') {
											return <Divider key={row.key} />
										}
										const { action } = row
										const isDisabled = Boolean(action.attributes?.disabled)
										const isDestructive = Boolean(
											action.attributes?.destructive,
										)
										const isChecked = action.state === 'on'
										const hasSubmenu = Boolean(
											action.subactions &&
											action.subactions.length > 0 &&
											!action.displayInline,
										)
										const iconName = resolveSfSymbolToMdi(action.image)
										const textColor = isDisabled
											? colors.onSurfaceDisabled
											: isDestructive
												? colors.error
												: (action.titleColor ?? colors.onSurface)
										const iconColor = isDisabled
											? colors.onSurfaceDisabled
											: isDestructive
												? colors.error
												: (action.imageColor ?? textColor)

										return (
											<Fragment key={row.key}>
												<Pressable
													disabled={isDisabled}
													onPress={() => handleActionPress(action)}
													style={({ pressed }) => [
														styles.menuItem,
														pressed && {
															backgroundColor: colors.surfaceVariant,
														},
													]}
												>
													{isChecked ? (
														<View style={styles.leadingIcon}>
															<PaperIcon
																source='check'
																size={18}
																color={colors.primary}
															/>
														</View>
													) : iconName ? (
														<View style={styles.leadingIcon}>
															<PaperIcon
																source={iconName}
																size={18}
																color={iconColor}
															/>
														</View>
													) : null}
													<View style={styles.menuItemTextContainer}>
														<Text
															variant='bodyMedium'
															style={{ color: textColor }}
															numberOfLines={1}
														>
															{action.title}
														</Text>
														{action.subtitle ? (
															<Text
																variant='bodySmall'
																style={{ color: colors.onSurfaceVariant }}
																numberOfLines={1}
															>
																{action.subtitle}
															</Text>
														) : null}
													</View>
													{hasSubmenu ? (
														<PaperIcon
															source='chevron-right'
															size={18}
															color={colors.onSurfaceVariant}
														/>
													) : null}
												</Pressable>
											</Fragment>
										)
									})}
								</ScrollView>
							</Surface>
						</View>
					</Modal>
				) : null}
			</View>
		)
	},
)

export default MenuView

const styles = StyleSheet.create({
	modalRoot: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.18)',
	},
	menuCard: {
		position: 'absolute',
		borderRadius: 14,
		overflow: 'hidden',
		paddingVertical: 4,
	},
	headerRow: {
		paddingHorizontal: 14,
		paddingVertical: 10,
	},
	menuItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 14,
		minHeight: MENU_ITEM_HEIGHT,
		paddingVertical: 8,
	},
	leadingIcon: {
		marginRight: 12,
		width: 20,
		alignItems: 'center',
	},
	menuItemTextContainer: {
		flex: 1,
	},
})
