import { createContext, useContext } from 'react'

type AccountStatus = 'active' | 'waitlist'

const AccountStatusContext = createContext<AccountStatus>('waitlist')

export function AccountStatusProvider({
  status,
  children,
}: {
  status: AccountStatus
  children: React.ReactNode
}) {
  return (
    <AccountStatusContext.Provider value={status}>
      {children}
    </AccountStatusContext.Provider>
  )
}

export function useAccountStatus() {
  return useContext(AccountStatusContext)
}
