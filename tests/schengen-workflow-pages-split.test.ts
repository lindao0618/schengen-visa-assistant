import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const workflowPages = [
  {
    route: "app/schengen-visa/materials/[country]/page.tsx",
    client: "app/schengen-visa/materials/[country]/CountryMaterialsClientPage.tsx",
    importPath: "./CountryMaterialsClientPage",
  },
  {
    route: "app/schengen-visa/slot-booking/france/monitor/page.tsx",
    client: "app/schengen-visa/slot-booking/france/monitor/FranceSlotMonitorClientPage.tsx",
    importPath: "./FranceSlotMonitorClientPage",
  },
  {
    route: "app/schengen-visa/slot-booking/france/book/success/page.tsx",
    client: "app/schengen-visa/slot-booking/france/book/success/FranceBookingSuccessClientPage.tsx",
    importPath: "./FranceBookingSuccessClientPage",
  },
  {
    route: "app/schengen-visa/slot-booking/[country]/monitor/success/page.tsx",
    client: "app/schengen-visa/slot-booking/[country]/monitor/success/MonitorSuccessClientPage.tsx",
    importPath: "./MonitorSuccessClientPage",
  },
]

const lightweightStaticPages = [
  {
    route: "app/schengen-visa/automation/page.tsx",
    requiredSnippets: ["/schengen-visa/france/automation"],
  },
  {
    route: "app/schengen-visa/materials/page.tsx",
    requiredSnippets: ["/schengen-visa/materials/${country.slug}", 'slug: "france"'],
  },
]

for (const page of lightweightStaticPages) {
  test(`${page.route} renders as a server-only static entry`, () => {
    const source = readSource(page.route)

    assert.doesNotMatch(source, /"use client"/)
    assert.doesNotMatch(source, /components\/ui\/card/)
    assert.doesNotMatch(source, /lucide-react/)
    for (const snippet of page.requiredSnippets) {
      assert.ok(source.includes(snippet))
    }
  })
}

for (const page of workflowPages) {
  test(`${page.route} lazy-loads its heavy client page`, () => {
    const source = readSource(page.route)

    assert.match(source, /dynamic\(/)
    assert.match(source, new RegExp(`import\\(["']${page.importPath}["']\\)`))
    assert.doesNotMatch(source, /useState/)
    assert.doesNotMatch(source, /useEffect/)
    assert.doesNotMatch(source, /useRouter/)
    assert.doesNotMatch(source, /useParams/)
  })

  test(`${page.client} keeps the interactive implementation`, () => {
    const source = readSource(page.client)

    assert.match(source, /"use client"/)
    assert.match(source, /next\/navigation/)
  })
}
