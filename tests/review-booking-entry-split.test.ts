import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const routes = [
  {
    route: "app/schengen-visa/slot-booking/france/book/page.tsx",
    client: "app/schengen-visa/slot-booking/france/book/FranceSlotBookingClientPage.tsx",
    importPath: "./FranceSlotBookingClientPage",
    heavyMarkers: [/useRouter/, /AnimatedSection/],
  },
  {
    route: "app/material-review/comprehensive/page.tsx",
    client: "app/material-review/comprehensive/ComprehensiveReviewClientPage.tsx",
    importPath: "./ComprehensiveReviewClientPage",
    heavyMarkers: [/useActiveApplicantProfile/, /useState/],
  },
  {
    route: "app/material-review/usa-review/page.tsx",
    client: "app/material-review/usa-review/UsaReviewClientPage.tsx",
    importPath: "./UsaReviewClientPage",
    heavyMarkers: [/useActiveApplicantProfile/, /useState/],
  },
]

for (const route of routes) {
  test(`${route.route} lazy-loads its heavy client page`, () => {
    const source = readSource(route.route)

    assert.match(source, /dynamic\(/)
    assert.match(source, new RegExp(`import\\(["']${route.importPath}["']\\)`))
    for (const marker of route.heavyMarkers) {
      assert.doesNotMatch(source, marker)
    }
  })

  test(`${route.client} keeps the interactive implementation`, () => {
    const source = readSource(route.client)

    for (const marker of route.heavyMarkers) {
      assert.match(source, marker)
    }
  })
}
