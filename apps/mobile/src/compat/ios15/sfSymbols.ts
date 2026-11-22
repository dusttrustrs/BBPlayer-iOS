const SF_SYMBOL_TO_MDI: Record<string, string> = {
	abc: 'alphabetical',
	'arrow.down.circle': 'download-circle-outline',
	'arrow.merge': 'merge',
	'arrow.right.to.line.circle': 'skip-next-circle-outline',
	'arrow.triangle.2.circlepath': 'sync',
	'arrow.up.and.down.text.horizontal': 'format-list-numbered',
	'arrow.up.arrow.down': 'swap-vertical',
	'arrow.up.arrow.down.circle': 'swap-vertical-circle-outline',
	checkmark: 'check',
	'doc.text': 'file-document-outline',
	ellipsis: 'dots-horizontal',
	'ellipsis.circle': 'dots-horizontal-circle-outline',
	headphones: 'headphones',
	link: 'link-variant',
	magnifyingglass: 'magnify',
	pencil: 'pencil-outline',
	'person.2': 'account-multiple-outline',
	'person.crop.circle': 'account-circle-outline',
	pin: 'pin-outline',
	'pin.fill': 'pin',
	plus: 'plus',
	'plus.rectangle.on.rectangle': 'playlist-plus',
	'square.and.arrow.down': 'content-save-outline',
	'square.and.arrow.up': 'share-variant-outline',
	translate: 'translate',
	trash: 'trash-can-outline',
	xmark: 'close',
}

export function resolveSfSymbolToMdi(icon: unknown): string | undefined {
	if (typeof icon === 'string' && icon.length > 0) {
		return SF_SYMBOL_TO_MDI[icon] ?? (icon.includes('.') ? undefined : icon)
	}
	if (icon && typeof icon === 'object' && 'ios' in icon) {
		const iosIcon = (icon as { ios?: unknown }).ios
		if (typeof iosIcon === 'string' && iosIcon.length > 0) {
			return (
				SF_SYMBOL_TO_MDI[iosIcon] ??
				(iosIcon.includes('.') ? undefined : iosIcon)
			)
		}
	}
	return undefined
}
