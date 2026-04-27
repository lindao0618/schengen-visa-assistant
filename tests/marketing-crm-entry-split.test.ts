import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("home route lazy-loads its marketing client page", () => {
  const source = readSource("app/page.tsx")

  assert.match(source, /dynamic\(/)
  assert.match(source, /import\(["']\.\/HomeClientPage["']\)/)
  assert.doesNotMatch(source, /useSession/)
  assert.doesNotMatch(source, /useRouter/)
  assert.doesNotMatch(source, /components\/ui\/card/)
})

const publicStaticPages = [
  {
    route: "app/guest/page.tsx",
    requiredSnippets: ["签证信息（游客模式）", "/register"],
  },
  {
    route: "app/pricing/page.tsx",
    requiredSnippets: ["选择适合您的方案", "年付"],
  },
]

for (const page of publicStaticPages) {
  test(`${page.route} renders as a server-only public page`, () => {
    const source = readSource(page.route)

    assert.doesNotMatch(source, /"use client"/)
    assert.doesNotMatch(source, /useState/)
    assert.doesNotMatch(source, /components\/ui\//)
    assert.doesNotMatch(source, /lucide-react/)
    for (const snippet of page.requiredSnippets) {
      assert.ok(source.includes(snippet))
    }
  })
}

const publicLazyPages = [
  {
    route: "app/enterprise/page.tsx",
    client: "app/enterprise/EnterpriseClientPage.tsx",
    importPath: "./EnterpriseClientPage",
  },
  {
    route: "app/docs/common-issues/page.tsx",
    client: "app/docs/common-issues/CommonIssuesClientPage.tsx",
    importPath: "./CommonIssuesClientPage",
  },
  {
    route: "app/register/page.tsx",
    client: "app/register/RegisterClientPage.tsx",
    importPath: "./RegisterClientPage",
  },
]

for (const page of publicLazyPages) {
  test(`${page.route} lazy-loads its interactive public client`, () => {
    const source = readSource(page.route)

    assert.match(source, /dynamic\(/)
    assert.match(source, new RegExp(`import\\(["']${page.importPath}["']\\)`))
    assert.doesNotMatch(source, /useState/)
    assert.doesNotMatch(source, /components\/ui\//)
  })

  test(`${page.client} keeps the interactive public implementation`, () => {
    const source = readSource(page.client)

    assert.match(source, /"use client"/)
  })
}

test("hotel booking route lazy-loads its booking form", () => {
  const pageSource = readSource("app/hotel-booking/page.tsx")
  const loaderSource = readSource("app/hotel-booking/HotelBookingFormLoader.tsx")

  assert.match(pageSource, /HotelBookingFormLoader/)
  assert.doesNotMatch(pageSource, /import \{ HotelBookingForm \} from ["']\.\/HotelBookingForm["']/)
  assert.match(loaderSource, /"use client"/)
  assert.match(loaderSource, /dynamic\(/)
  assert.match(loaderSource, /import\(["']\.\/HotelBookingForm["']\)/)
})

test("services hotel booking route renders as a server-only static page", () => {
  const source = readSource("app/services/hotel-booking/page.tsx")

  assert.doesNotMatch(source, /"use client"/)
  assert.doesNotMatch(source, /components\/ui\//)
  assert.doesNotMatch(source, /lucide-react/)
  assert.ok(source.includes("Booking.com"))
  assert.ok(source.includes("/material-customization"))
})

test("apply route lazy-loads its heavy client page", () => {
  const source = readSource("app/apply/page.tsx")

  assert.match(source, /dynamic\(/)
  assert.match(source, /import\(["']\.\/ApplyClientPage["']\)/)
  assert.doesNotMatch(source, /useState/)
  assert.doesNotMatch(source, /useRouter/)
  assert.doesNotMatch(source, /components\/ui\/tabs/)
})

test("usa visa route lazy-loads its heavy client page", () => {
  const source = readSource("app/usa-visa/page.tsx")

  assert.match(source, /dynamic\(/)
  assert.match(source, /import\(["']\.\/USAVisaClientPage["']\)/)
  assert.doesNotMatch(source, /useSearchParams/)
  assert.doesNotMatch(source, /components\/photo-checker/)
  assert.doesNotMatch(source, /components\/ds160-form/)
})

test("usa visa client still lazy-loads tab tools and task lists", () => {
  const source = readSource("app/usa-visa/USAVisaClientPage.tsx")

  assert.match(source, /dynamic\(/)
  assert.match(source, /import\(["']\.\/components\/photo-checker["']\)/)
  assert.match(source, /import\(["']\.\/components\/ds160-form["']\)/)
  assert.match(source, /import\(["']\.\/components\/task-list["']\)/)
  assert.doesNotMatch(source, /import \{ PhotoChecker \} from ["']\.\/components\/photo-checker["']/)
  assert.doesNotMatch(source, /import \{ DS160Form \} from ["']\.\/components\/ds160-form["']/)
  assert.doesNotMatch(source, /import \{ TaskList \} from ["']\.\/components\/task-list["']/)
})

test("applicants route renders a light authenticated shell", () => {
  const pageSource = readSource("app/applicants/page.tsx")
  const shellSource = readSource("app/applicants/ApplicantsPageShell.tsx")

  assert.match(pageSource, /ApplicantsPageShell/)
  assert.doesNotMatch(pageSource, /ApplicantsCrmClientPage/)
  assert.match(shellSource, /dynamic\(/)
  assert.match(shellSource, /import\(["']\.\/ApplicantsCrmClientPage["']\)/)
  assert.match(shellSource, /ssr:\s*false/)
})
