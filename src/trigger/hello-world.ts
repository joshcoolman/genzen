import { task } from '@trigger.dev/sdk/v3'

export const helloWorld = task({
  id: 'hello-world',
  // eslint-disable-next-line @typescript-eslint/require-await
  run: async (payload: { name: string }) => {
    console.log(`Hello ${payload.name}!`)

    return {
      message: `Hello ${payload.name}!`,
      timestamp: new Date().toISOString(),
    }
  },
})
