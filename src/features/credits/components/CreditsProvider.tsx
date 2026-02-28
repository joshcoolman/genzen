import {
  CreditsContext,
  useCreditsProvider,
} from '@/features/credits/hooks/use-credits'

export function CreditsProvider({
  accessToken,
  children,
}: {
  accessToken: string | undefined
  children: React.ReactNode
}) {
  const credits = useCreditsProvider(accessToken)
  return (
    <CreditsContext.Provider value={credits}>
      {children}
    </CreditsContext.Provider>
  )
}
