export async function run(fn: () => Promise<void>) {
  try {
    await fn()
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
