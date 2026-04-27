import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("dashboard route lazy-loads its heavy client page", () => {
  const source = readSource("app/dashboard/page.tsx")

  assert.match(source, /dynamic(?:<[^>]+>)?\(/)
  assert.match(source, /import\(["']\.\/DashboardClientPage["']\)/)
  assert.doesNotMatch(source, /next-auth\/react/)
  assert.doesNotMatch(source, /components\/visa-services/)
})

test("dashboard client lazy-loads the visa services module", () => {
  const source = readSource("app/dashboard/DashboardClientPage.tsx")

  assert.match(source, /dynamic\(/)
  assert.match(source, /import\(["']\.\/components\/visa-services["']\)/)
  assert.doesNotMatch(source, /import \{ VisaServicesModule \} from ['"]\.\/components\/visa-services['"]/)
})

test("dashboard visa services lazy-loads task list modules", () => {
  const source = readSource("app/dashboard/components/visa-services.tsx")

  assert.match(source, /dynamic\(/)
  assert.doesNotMatch(source, /import \{ TaskList \} from ['"]@\/app\/usa-visa\/components\/task-list['"]/)
  assert.doesNotMatch(source, /import \{ FranceTaskList \} from ['"]@\/app\/schengen-visa\/france\/automation\/FranceTaskList['"]/)
  assert.doesNotMatch(source, /import \{ MaterialTaskList \} from ['"]@\/components\/MaterialTaskList['"]/)
})

test("appointment booking route lazy-loads its heavy client page", () => {
  const source = readSource("app/usa-visa/appointment-booking/page.tsx")

  assert.match(source, /dynamic\(/)
  assert.match(source, /import\(["']\.\/AppointmentBookingClientPage["']\)/)
  assert.doesNotMatch(source, /framer-motion/)
  assert.doesNotMatch(source, /booking-steps\/step-/)
})

test("appointment booking client lazy-loads step components", () => {
  const source = readSource("app/usa-visa/appointment-booking/AppointmentBookingClientPage.tsx")

  assert.match(source, /dynamic(?:<[^>]+>)?\(/)
  for (const step of ["one", "two", "three", "four", "five"]) {
    assert.match(source, new RegExp(`import\\(["']@/app/usa-visa/components/booking-steps/step-${step}["']\\)`))
    assert.doesNotMatch(source, new RegExp(`import \\{ Step[A-Za-z]+ \\} from ["']@/app/usa-visa/components/booking-steps/step-${step}["']`))
  }
})

for (const step of ["one", "two", "three", "four", "five"]) {
  test(`booking step ${step} imports form types from the shared type module`, () => {
    const source = readSource(`app/usa-visa/components/booking-steps/step-${step}.tsx`)

    assert.match(source, /import type \{ .*BookingFormData/)
    assert.doesNotMatch(source, /from ["']\.\.\/\.\.\/appointment-booking\/page["']/)
  })
}
