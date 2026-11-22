export const widgetsDirectory: string | null = null

export function addUserInteractionListener(
	_listener: (event: { target: string }) => void,
) {
	return {
		remove() {
			// no-op on iOS 15 compatibility build
		},
	}
}

export function createLiveActivity<TProps extends Record<string, unknown>>(
	_name: string,
	_layout: (props: TProps) => unknown,
) {
	return {
		start(_props: TProps, _url?: string) {
			return {
				async update(_nextProps: TProps) {},
				async end(_policy?: string) {},
			}
		},
		getInstances() {
			return [] as {
				update: (nextProps: TProps) => Promise<void>
				end: (policy?: string) => Promise<void>
			}[]
		},
	}
}

export default {
	widgetsDirectory,
	addUserInteractionListener,
	createLiveActivity,
}
