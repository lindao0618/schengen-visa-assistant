import type { BasicFormState } from "./types"

export function buildApplicantProfileUpdatePayload(form: BasicFormState) {
  return {
    name: form.name,
    phone: form.phone,
    email: form.email,
    wechat: form.wechat,
    passportNumber: form.passportNumber,
    note: form.note,
    usVisa: {
      surname: form.usVisaSurname,
      birthYear: form.usVisaBirthYear,
      passportNumber: form.usVisaPassportNumber,
    },
    schengen: {
      country: form.schengenCountry,
      city: form.schengenVisaCity,
    },
  }
}
