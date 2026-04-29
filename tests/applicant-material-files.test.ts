import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"

import {
  getApplicantMaterialFilesHandoffKey,
  selectVisibleApplicantMaterialFiles,
  shouldFetchApplicantMaterialFiles,
  shouldShowApplicantMaterialFilesLoading,
} from "../lib/applicant-material-files"

test("shouldFetchApplicantMaterialFiles only loads files when materials tab is active", () => {
  assert.equal(
    shouldFetchApplicantMaterialFiles({
      activeTab: "basic",
      hasFilesLoaded: false,
      loading: false,
    }),
    false,
  )
  assert.equal(
    shouldFetchApplicantMaterialFiles({
      activeTab: "materials",
      hasFilesLoaded: false,
      loading: false,
    }),
    true,
  )
})

test("shouldFetchApplicantMaterialFiles avoids duplicate material file requests", () => {
  assert.equal(
    shouldFetchApplicantMaterialFiles({
      activeTab: "materials",
      hasFilesLoaded: true,
      loading: false,
    }),
    false,
  )
  assert.equal(
    shouldFetchApplicantMaterialFiles({
      activeTab: "materials",
      hasFilesLoaded: false,
      loading: true,
    }),
    false,
  )
})

test("shouldShowApplicantMaterialFilesLoading only blocks when no visible files are available", () => {
  assert.equal(
    shouldShowApplicantMaterialFilesLoading({
      loading: true,
      visibleFileCount: 0,
    }),
    true,
  )
  assert.equal(
    shouldShowApplicantMaterialFilesLoading({
      loading: true,
      visibleFileCount: 5,
    }),
    false,
  )
  assert.equal(
    shouldShowApplicantMaterialFilesLoading({
      loading: false,
      visibleFileCount: 0,
    }),
    false,
  )
})

test("selectVisibleApplicantMaterialFiles prefers freshly uploaded files before remote sync finishes", () => {
  const freshFiles = {
    schengenExcel: {
      originalName: "胡天珂-预计出行明天晚上.xlsx",
      uploadedAt: "2026-04-29T04:27:28.103Z",
    },
  }

  assert.deepEqual(
    selectVisibleApplicantMaterialFiles({
      materialFiles: freshFiles,
      materialFilesLoaded: false,
      detailFiles: {},
    }),
    freshFiles,
  )
})

test("selectVisibleApplicantMaterialFiles falls back to detail files before material request completes", () => {
  const detailFiles = {
    usVisaPhoto: {
      originalName: "photo.jpg",
      uploadedAt: "2026-04-29T04:27:28.103Z",
    },
  }

  assert.deepEqual(
    selectVisibleApplicantMaterialFiles({
      materialFiles: {},
      materialFilesLoaded: false,
      detailFiles,
    }),
    detailFiles,
  )
})

test("getApplicantMaterialFilesHandoffKey is scoped by applicant id", () => {
  assert.equal(
    getApplicantMaterialFilesHandoffKey("applicant-123"),
    "applicant-material-files:handoff:applicant-123",
  )
})

test("material file fetch effect does not abort itself when loading state changes", () => {
  const source = readFileSync(
    path.join(process.cwd(), "app", "applicants", "[id]", "detail", "use-applicant-material-files.ts"),
    "utf8",
  )

  assert.match(source, /materialFilesLoadingRef\.current/)
  assert.doesNotMatch(
    source,
    /\[activeTab, applicantId, detailProfileId, materialFilesLoaded, materialFilesLoading, setDetail\]/,
  )
})
