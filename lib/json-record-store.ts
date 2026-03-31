import fs from "fs/promises"
import path from "path"

type MaybePromise<T> = T | Promise<T>

export interface JsonRecordStoreOptions<TRecord, TStored = TRecord> {
  filePath: string
  toStoredRecord?: (record: TRecord) => TStored
  fromStoredRecord?: (record: TStored) => TRecord
}

export function createJsonRecordStore<TRecord, TStored = TRecord>({
  filePath,
  toStoredRecord,
  fromStoredRecord,
}: JsonRecordStoreOptions<TRecord, TStored>) {
  let fileOpsQueue = Promise.resolve<unknown>(undefined)

  async function runExclusive<TResult>(fn: () => MaybePromise<TResult>): Promise<TResult> {
    const previous = fileOpsQueue
    let resolveNext!: () => void

    fileOpsQueue = new Promise<void>((resolve) => {
      resolveNext = resolve
    })

    try {
      await previous
      return await fn()
    } finally {
      resolveNext()
    }
  }

  async function readRecords(): Promise<Record<string, TRecord>> {
    try {
      const raw = await fs.readFile(filePath, "utf-8")
      const parsed = JSON.parse(raw) as Record<string, TStored>

      if (!fromStoredRecord) {
        return parsed as unknown as Record<string, TRecord>
      }

      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, fromStoredRecord(value)]),
      )
    } catch {
      return {}
    }
  }

  async function writeRecords(records: Record<string, TRecord>): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    const output = toStoredRecord
      ? Object.fromEntries(
          Object.entries(records).map(([key, value]) => [key, toStoredRecord(value)]),
        )
      : records

    await fs.writeFile(filePath, JSON.stringify(output, null, 2), "utf-8")
  }

  return {
    runExclusive,
    readRecords,
    writeRecords,
  }
}
