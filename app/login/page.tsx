import { View } from './view'

// No signed-in check here. `proxy.ts` bounces an authenticated request to
// /images before this component runs, which is what retires the
// loading/redirect dance the TanStack version needed.
export default function LoginPage() {
  return <View />
}
