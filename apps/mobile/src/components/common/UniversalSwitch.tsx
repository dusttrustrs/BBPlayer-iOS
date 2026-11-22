import { memo } from 'react'
import { Switch } from 'react-native'
import { useTheme } from 'react-native-paper'

type UniversalSwitchProps = {
	value: boolean
	onValueChange: (value: boolean) => void
	disabled?: boolean
	testID?: string
}

const UniversalSwitch = memo(function UniversalSwitch({
	disabled,
	onValueChange,
	testID,
	value,
}: UniversalSwitchProps) {
	const { colors } = useTheme()
	return (
		<Switch
			disabled={disabled}
			onValueChange={onValueChange}
			testID={testID}
			trackColor={{
				false: colors.surfaceVariant,
				true: colors.primary,
			}}
			value={value}
		/>
	)
})

export default UniversalSwitch
